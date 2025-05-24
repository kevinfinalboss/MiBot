import { Command } from '../../../types/commands/Command';
import { CommandContext } from '../../../types/commands/CommandContext';
import { EmbedBuilder, SlashCommandBuilder, AutocompleteInteraction } from 'discord.js';
import { MiClient } from '../../../structures/MiClient';

function formatBytes(bytes: string): string {
  if (!bytes || bytes === '0') return '0 B';
  
  if (bytes.endsWith('Ki')) {
    const value = parseInt(bytes.replace('Ki', '')) * 1024;
    return formatBytesNumber(value);
  }
  
  const numBytes = parseInt(bytes);
  if (!isNaN(numBytes)) {
    return formatBytesNumber(numBytes);
  }
  
  return bytes;
}

function formatBytesNumber(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

export default {
  data: new SlashCommandBuilder()
    .setName('get-nodes')
    .setDescription('🖥️ Lista nodes do cluster Kubernetes com informações detalhadas')
    .addStringOption(option =>
      option
        .setName('node')
        .setDescription('Node específico para ver detalhes (opcional - autocomplete disponível)')
        .setRequired(false)
        .setAutocomplete(true)
    ),

  options: {
    categoria: 'Sistema',
    type: 'SLASH',
    ownerOnly: true,
    guildOnly: false,
    cooldown: 5,
    enabled: true,
    visible: true,
    usage: '/get-nodes [node]',
    examples: [
      '/get-nodes',
      '/get-nodes node:master-1',
      '/get-nodes node:worker-1'
    ]
  },

  async executeAutocomplete(client: MiClient, interaction: AutocompleteInteraction) {
    if (!client.kubernetes) {
      return interaction.respond([]);
    }

    try {
      const focusedValue = interaction.options.getFocused();
      const nodes = await client.kubernetes.nodes.listNodes();
      
      const filtered = nodes
        .filter(node => node.name.toLowerCase().includes(focusedValue.toLowerCase()))
        .slice(0, 25)
        .map(node => ({
          name: `${node.name} (${node.status} - ${node.roles.join(', ')})`,
          value: node.name
        }));

      await interaction.respond(filtered);
    } catch (error) {
      await interaction.respond([]);
    }
  },

  async execute(client: MiClient, context: CommandContext) {
    const { interaction } = context;

    if (!interaction) return;

    if (!client.kubernetes) {
      return interaction.reply({
        content: '❌ **Kubernetes não está disponível!**\n\n' +
                'O cliente Kubernetes não foi inicializado corretamente.',
        ephemeral: true
      });
    }

    const nodeName = interaction.options.getString('node');

    try {
      await interaction.deferReply();

      if (nodeName) {
        const node = await client.kubernetes.nodes.readNode(nodeName);

        if (!node) {
          const embed = new EmbedBuilder()
            .setTitle('🔍 Node Não Encontrado')
            .setDescription(`O node \`${nodeName}\` não foi encontrado no cluster.`)
            .setColor(0xFFA500)
            .setTimestamp()
            .setFooter({
              text: `Kubernetes Cluster • ${client.user?.username}`,
              iconURL: client.user?.displayAvatarURL()
            });

          return interaction.editReply({ embeds: [embed] });
        }

        const statusIcon = node.status === 'Ready' ? '🟢' : '🔴';
        const rolesText = node.roles.length > 0 ? node.roles.join(', ') : 'worker';
        
        const capacityInfo = node.capacity ? 
          `**CPU:** ${node.capacity.cpu}\n` +
          `**Memória:** ${formatBytes(node.capacity.memory)}\n` +
          `**Pods:** ${node.capacity.pods}\n` +
          `**Storage:** ${formatBytes(node.capacity.storage)}` : 
          'Informações não disponíveis';

        const allocatableInfo = node.allocatable ? 
          `**CPU:** ${node.allocatable.cpu}\n` +
          `**Memória:** ${formatBytes(node.allocatable.memory)}\n` +
          `**Pods:** ${node.allocatable.pods}\n` +
          `**Storage:** ${formatBytes(node.allocatable.storage)}` : 
          'Informações não disponíveis';

        const conditionsInfo = node.conditions && node.conditions.length > 0 ?
          node.conditions
            .filter(c => c.status === 'True' || c.type === 'Ready')
            .slice(0, 5)
            .map(condition => {
              const conditionIcon = condition.status === 'True' ? 
                (condition.type === 'Ready' ? '✅' : 
                 condition.type === 'DiskPressure' ? '💾' :
                 condition.type === 'MemoryPressure' ? '🧠' :
                 condition.type === 'PIDPressure' ? '🔢' : '⚠️') : '❌';
              return `${conditionIcon} **${condition.type}**: ${condition.status}`;
            })
            .join('\n') : 'Nenhuma condição reportada';

        const embed = new EmbedBuilder()
          .setTitle(`🖥️ Node: ${node.name}`)
          .setDescription(
            `${statusIcon} **Status:** ${node.status}\n` +
            `🏷️ **Roles:** ${rolesText}\n` +
            `⏱️ **Age:** ${node.age}\n` +
            `🔧 **Versão:** ${node.version}`
          )
          .addFields(
            {
              name: '🌐 Informações de Rede',
              value: `**IP Interno:** \`${node.internalIP}\`\n**IP Externo:** \`${node.externalIP || 'N/A'}\``,
              inline: true
            },
            {
              name: '💻 Sistema Operacional',
              value: `**OS:** ${node.osImage || 'N/A'}\n**Kernel:** ${node.kernelVersion || 'N/A'}\n**Arch:** ${node.architecture || 'N/A'}`,
              inline: true
            },
            {
              name: '🐳 Container Runtime',
              value: node.containerRuntime || 'N/A',
              inline: true
            },
            {
              name: '📊 Capacidade Total',
              value: capacityInfo,
              inline: true
            },
            {
              name: '🎯 Recursos Alocáveis',
              value: allocatableInfo,
              inline: true
            },
            {
              name: '⚡ Condições do Node',
              value: conditionsInfo,
              inline: false
            }
          )
          .setColor(node.status === 'Ready' ? 0x4CAF50 : 0xFF5722)
          .setTimestamp()
          .setFooter({
            text: `Kubernetes Node • ${client.user?.username}`,
            iconURL: client.user?.displayAvatarURL()
          });

        return interaction.editReply({ embeds: [embed] });

      } else {
        const nodes = await client.kubernetes.nodes.listNodes();

        if (nodes.length === 0) {
          const embed = new EmbedBuilder()
            .setTitle('🔍 Nenhum Node Encontrado')
            .setDescription('Não foram encontrados nodes no cluster.')
            .setColor(0xFFA500)
            .setTimestamp()
            .setFooter({
              text: `Kubernetes Cluster • ${client.user?.username}`,
              iconURL: client.user?.displayAvatarURL()
            });

          return interaction.editReply({ embeds: [embed] });
        }

        const readyNodes = nodes.filter(n => n.status === 'Ready').length;
        const healthyPercentage = Math.round((readyNodes / nodes.length) * 100);

        const rolesCounts = nodes.reduce((acc, node) => {
          node.roles.forEach(role => {
            acc[role] = (acc[role] || 0) + 1;
          });
          return acc;
        }, {} as Record<string, number>);

        const rolesText = Object.entries(rolesCounts)
          .map(([role, count]) => {
            const icon = role === 'master' || role === 'control-plane' ? '👑' : 
                        role === 'worker' ? '⚙️' : '🔧';
            return `${icon} **${role}**: ${count}`;
          })
          .join('\n');

        let nodesList = '';
        nodesList = nodes.map(node => {
          const statusIcon = node.status === 'Ready' ? '🟢' : '🔴';
          const rolesDisplay = node.roles.length > 0 ? node.roles.join(', ') : 'worker';
          const versionShort = node.version.replace('v', '').substring(0, 8);
          
          return `${statusIcon} **${node.name}**\n` +
                 `   🏷️ ${rolesDisplay} • ⏱️ ${node.age} • 🔧 ${versionShort}\n` +
                 `   🌐 \`${node.internalIP}\`${node.externalIP ? ` • \`${node.externalIP}\`` : ''}`;
        }).join('\n\n');

        const embed = new EmbedBuilder()
          .setTitle('🖥️ Nodes do Cluster Kubernetes')
          .setDescription(
            `**📊 Status Geral**\n` +
            `🖥️ **Total de Nodes:** ${nodes.length}\n` +
            `💚 **Saúde do Cluster:** ${healthyPercentage}% (${readyNodes}/${nodes.length})\n` +
            `🏷️ **Distribuição por Roles**`
          )
          .addFields(
            {
              name: '👑 Roles dos Nodes',
              value: rolesText,
              inline: true
            },
            {
              name: '🖥️ Lista de Nodes',
              value: nodesList,
              inline: false
            }
          )
          .setColor(healthyPercentage >= 80 ? 0x4CAF50 : healthyPercentage >= 50 ? 0xFFA500 : 0xFF5722)
          .setTimestamp()
          .setFooter({
            text: `Kubernetes Dashboard • Use /get-nodes node:<nome> para detalhes`,
            iconURL: client.user?.displayAvatarURL()
          });

        return interaction.editReply({ embeds: [embed] });
      }

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      const embed = new EmbedBuilder()
        .setTitle('❌ Erro ao Listar Nodes')
        .setDescription(`**Erro encontrado:**\n\`\`\`\n${errorMessage}\n\`\`\``)
        .setColor(0xFF0000)
        .setTimestamp()
        .setFooter({
          text: `Kubernetes Error • ${client.user?.username}`,
          iconURL: client.user?.displayAvatarURL()
        });

      return interaction.editReply({ embeds: [embed] });
    }
  }
} as Command;