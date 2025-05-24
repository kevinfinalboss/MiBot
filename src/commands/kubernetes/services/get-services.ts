import { Command } from '../../../types/commands/Command';
import { CommandContext } from '../../../types/commands/CommandContext';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { MiClient } from '../../../structures/MiClient';

export default {
  data: new SlashCommandBuilder()
    .setName('get-services')
    .setDescription('🌐 Lista services do cluster Kubernetes com informações detalhadas')
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
    usage: '/get-services [namespace]',
    examples: [
      '/get-services',
      '/get-services namespace:default',
      '/get-services namespace:kube-system'
    ]
  },

  async executeAutocomplete(client: MiClient, interaction) {
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

      const [services] = await Promise.all([
        client.kubernetes.services.listServices(namespace || undefined)
      ]);

      if (services.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('🔍 Nenhum Service Encontrado')
          .setDescription(namespace ? 
            `Não foram encontrados services na namespace \`${namespace}\`` :
            'Não foram encontrados services em nenhuma namespace')
          .setColor(0xFFA500)
          .setTimestamp()
          .setFooter({
            text: `Kubernetes Cluster • ${client.user?.username}`,
            iconURL: client.user?.displayAvatarURL()
          });

        return interaction.editReply({ embeds: [embed] });
      }

      const groupedServices = services.reduce((acc, service) => {
        if (!acc[service.namespace]) {
          acc[service.namespace] = [];
        }
        acc[service.namespace].push(service);
        return acc;
      }, {} as Record<string, typeof services>);

      const typeCounts = services.reduce((acc, service) => {
        acc[service.type] = (acc[service.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const externalServices = services.filter(s => s.externalIP || s.type === 'LoadBalancer').length;
      const totalPorts = services.reduce((acc, service) => acc + service.ports.length, 0);

      let namespacesInfo = '';
      if (!namespace) {
        namespacesInfo = Object.entries(groupedServices)
          .slice(0, 6)
          .map(([ns, nsServices]) => {
            const external = nsServices.filter(s => s.externalIP || s.type === 'LoadBalancer').length;
            const externalIcon = external > 0 ? '🌍' : '🏠';
            return `${externalIcon} **${ns}**: ${nsServices.length} services${external > 0 ? ` (${external} externos)` : ''}`;
          })
          .join('\n');
        
        if (Object.keys(groupedServices).length > 6) {
          namespacesInfo += `\n... e mais ${Object.keys(groupedServices).length - 6} namespaces`;
        }
      }

      let servicesList = '';
      const displayServices = namespace ? services.slice(0, 12) : services.slice(0, 10);
      
      servicesList = displayServices.map(service => {
        const typeIcon = service.type === 'LoadBalancer' ? '🌍' : 
                        service.type === 'NodePort' ? '🔗' : 
                        service.type === 'ClusterIP' ? '🏠' : 
                        service.type === 'ExternalName' ? '📡' : '🔧';
        
        const namespaceText = namespace ? '' : ` • \`${service.namespace}\``;
        const externalText = service.externalIP ? `\n   🌐 **External:** \`${service.externalIP}\`` : '';
        
        const portsText = service.ports.length > 0 ? 
          service.ports.slice(0, 3).map(p => `${p.port}:${p.targetPort}/${p.protocol}`).join(', ') : 
          'No ports';
        
        const morePortsText = service.ports.length > 3 ? ` +${service.ports.length - 3} more` : '';
        
        return `${typeIcon} **${service.name}** (\`${service.type}\`)${namespaceText}\n` +
               `   🏠 **Cluster IP:** \`${service.clusterIP}\`\n` +
               `   🔌 **Ports:** \`${portsText}${morePortsText}\`${externalText}`;
      }).join('\n\n');

      if (services.length > displayServices.length) {
        servicesList += `\n\n🔗 **+${services.length - displayServices.length} services adicionais**`;
      }

      const typeText = Object.entries(typeCounts)
        .map(([type, count]) => {
          const icon = type === 'LoadBalancer' ? '🌍' : 
                      type === 'NodePort' ? '🔗' : 
                      type === 'ClusterIP' ? '🏠' : 
                      type === 'ExternalName' ? '📡' : '🔧';
          return `${icon} **${type}**: ${count}`;
        })
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle('🌐 Services do Cluster Kubernetes')
        .setDescription(
          `**📊 Resumo Geral**\n` +
          `🔗 **Total de Services:** ${services.length}\n` +
          `🌍 **Services Externos:** ${externalServices}\n` +
          `🔌 **Total de Portas:** ${totalPorts}\n` +
          `🏷️ **Scope:** ${namespace ? `Namespace \`${namespace}\`` : `${Object.keys(groupedServices).length} namespaces`}`
        )
        .addFields(
          {
            name: '📈 Tipos de Services',
            value: typeText,
            inline: true
          }
        )
        .setColor(externalServices > 0 ? 0x2196F3 : 0x4CAF50)
        .setTimestamp();

      if (!namespace && namespacesInfo) {
        embed.addFields({
          name: '📁 Resumo por Namespace',
          value: namespacesInfo,
          inline: false
        });
      }

      embed.addFields({
        name: '🔗 Lista de Services',
        value: servicesList,
        inline: false
      });

      embed.setFooter({
        text: `Kubernetes Dashboard • Use /get-services namespace:<nome> para filtrar`,
        iconURL: client.user?.displayAvatarURL()
      });

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      const embed = new EmbedBuilder()
        .setTitle('❌ Erro ao Listar Services')
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