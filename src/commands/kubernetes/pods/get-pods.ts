import { Command } from '../../../types/commands/Command';
import { CommandContext } from '../../../types/commands/CommandContext';
import { EmbedBuilder, SlashCommandBuilder, AutocompleteInteraction } from 'discord.js';
import { MiClient } from '../../../structures/MiClient';

function formatResources(resources: any): string {
  const parts: string[] = [];
  if (resources.requests?.cpu || resources.requests?.memory) {
    const cpu = resources.requests?.cpu || '';
    const memory = resources.requests?.memory || '';
    parts.push(`📊 Req: ${cpu}${cpu && memory ? '/' : ''}${memory}`);
  }
  if (resources.limits?.cpu || resources.limits?.memory) {
    const cpu = resources.limits?.cpu || '';
    const memory = resources.limits?.memory || '';
    parts.push(`🔒 Lim: ${cpu}${cpu && memory ? '/' : ''}${memory}`);
  }
  return parts.length > 0 ? `\n   ${parts.join(' • ')}` : '';
}

export default {
  data: new SlashCommandBuilder()
    .setName('get-pods')
    .setDescription('🐳 Lista pods do cluster Kubernetes com informações detalhadas')
    .addStringOption(option =>
      option
        .setName('namespace')
        .setDescription('Namespace específico (opcional - autocomplete disponível)')
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
    usage: '/get-pods [namespace]',
    examples: [
      '/get-pods',
      '/get-pods namespace:default',
      '/get-pods namespace:kube-system'
    ]
  },

  async executeAutocomplete(client: MiClient, interaction: AutocompleteInteraction) {
    if (!client.kubernetes) {
      return interaction.respond([]);
    }

    try {
      const focusedValue = interaction.options.getFocused();
      const namespaces = await client.kubernetes.namespaces.listNamespaces();
      
      const filtered = namespaces
        .filter(ns => ns.name.toLowerCase().includes(focusedValue.toLowerCase()))
        .slice(0, 25)
        .map(ns => ({
          name: `${ns.name} (${ns.status})`,
          value: ns.name
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

    const namespace = interaction.options.getString('namespace');

    try {
      await interaction.deferReply();

      const pods = await client.kubernetes.pods.listPods(namespace || undefined);

      if (pods.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('🔍 Nenhum Pod Encontrado')
          .setDescription(namespace ? 
            `Não foram encontrados pods na namespace \`${namespace}\`` :
            'Não foram encontrados pods em nenhuma namespace')
          .setColor(0xFFA500)
          .setTimestamp()
          .setFooter({
            text: `Kubernetes Cluster • ${client.user?.username}`,
            iconURL: client.user?.displayAvatarURL()
          });

        return interaction.editReply({ embeds: [embed] });
      }

      const groupedPods = pods.reduce((acc, pod) => {
        if (!acc[pod.namespace]) {
          acc[pod.namespace] = [];
        }
        acc[pod.namespace].push(pod);
        return acc;
      }, {} as Record<string, typeof pods>);

      const statusCounts = pods.reduce((acc, pod) => {
        acc[pod.status] = (acc[pod.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const totalRestarts = pods.reduce((acc, pod) => acc + pod.restarts, 0);
      const runningPods = pods.filter(p => p.status === 'Running').length;
      const healthyPercentage = Math.round((runningPods / pods.length) * 100);

      let namespacesInfo = '';
      if (!namespace) {
        namespacesInfo = Object.entries(groupedPods)
          .slice(0, 6)
          .map(([ns, nsPods]) => {
            const running = nsPods.filter(p => p.status === 'Running').length;
            const statusIcon = running === nsPods.length ? '🟢' : running > 0 ? '🟡' : '🔴';
            return `${statusIcon} **${ns}**: ${running}/${nsPods.length} pods`;
          })
          .join('\n');
        
        if (Object.keys(groupedPods).length > 6) {
          namespacesInfo += `\n... e mais ${Object.keys(groupedPods).length - 6} namespaces`;
        }
      }

      let podsList = '';
      const displayPods = namespace ? pods.slice(0, 15) : pods.slice(0, 12);
      
      podsList = displayPods.map(pod => {
        const statusIcon = pod.status === 'Running' ? '🟢' : 
                          pod.status === 'Pending' ? '🟡' : 
                          pod.status === 'Succeeded' ? '✅' : 
                          pod.status === 'Failed' ? '❌' : '🔴';
        
        const restartText = pod.restarts > 0 ? ` 🔄${pod.restarts}` : '';
        const namespaceText = namespace ? '' : ` • \`${pod.namespace}\``;
        const ipText = pod.ip ? ` • \`${pod.ip}\`` : '';
        const resourceText = pod.resources ? formatResources(pod.resources) : '';
        
        return `${statusIcon} **${pod.name}**${restartText}\n` +
               `   ⏱️ ${pod.age}${namespaceText}${ipText}${resourceText}`;
      }).join('\n\n');

      if (pods.length > displayPods.length) {
        podsList += `\n\n📦 **+${pods.length - displayPods.length} pods adicionais**`;
      }

      const statusText = Object.entries(statusCounts)
        .map(([status, count]) => {
          const icon = status === 'Running' ? '🟢' : 
                      status === 'Pending' ? '🟡' : 
                      status === 'Succeeded' ? '✅' : 
                      status === 'Failed' ? '❌' : '🔴';
          return `${icon} **${status}**: ${count}`;
        })
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle('🐳 Pods do Cluster Kubernetes')
        .setDescription(
          `**📊 Status Geral**\n` +
          `🚀 **Total de Pods:** ${pods.length}\n` +
          `💚 **Saúde do Cluster:** ${healthyPercentage}% (${runningPods}/${pods.length})\n` +
          `🔄 **Total de Restarts:** ${totalRestarts}\n` +
          `🏷️ **Scope:** ${namespace ? `Namespace \`${namespace}\`` : `${Object.keys(groupedPods).length} namespaces`}`
        )
        .addFields(
          {
            name: '📈 Status dos Pods',
            value: statusText,
            inline: true
          }
        )
        .setColor(healthyPercentage >= 80 ? 0x4CAF50 : healthyPercentage >= 50 ? 0xFFA500 : 0xFF5722)
        .setTimestamp();

      if (!namespace && namespacesInfo) {
        embed.addFields({
          name: '📁 Resumo por Namespace',
          value: namespacesInfo,
          inline: false
        });
      }

      embed.addFields({
        name: '📦 Lista de Pods',
        value: podsList,
        inline: false
      });

      embed.setFooter({
        text: `Kubernetes Dashboard • Use /get-pods namespace:<nome> para filtrar`,
        iconURL: client.user?.displayAvatarURL()
      });

      return interaction.editReply({ embeds: [embed] });

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      const embed = new EmbedBuilder()
        .setTitle('❌ Erro ao Listar Pods')
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