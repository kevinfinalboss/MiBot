import { SlashCommandBuilder, EmbedBuilder, version as discordJSVersion } from 'discord.js';
import { Command } from '../../types/commands/Command';
import { CommandContext } from '../../types/commands/CommandContext';
import { MiClient } from '../../structures/MiClient';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Mostra informações de latência e status do bot'),

  options: {
    categoria: 'Util',
    type: 'HYBRID',
    aliases: ['pong', 'latencia', 'status'],
    cooldown: 3,
    visible: true,
    usage: 'ping',
    examples: ['ping', 'status']
  },

  async execute(client: MiClient, context: CommandContext) {
    const startTime = Date.now();
    
    let initialMessage;
    if (context.isSlash) {
      await context.interaction!.deferReply();
      initialMessage = await context.interaction!.editReply('Calculando ping...');
    } else {
      initialMessage = await context.message!.reply('Calculando ping...');
    }
    
    const apiLatency = Math.round(client.ws.ping);
    const responseTime = Date.now() - startTime;
    
    let lavalinkStatus = '🔴 Desconectado';
    let lavalinkPing = 'N/A';
    
    try {
      const lavalink = client.lavalink;
      if (lavalink && lavalink.nodeManager) {
        const nodes = lavalink.nodeManager.nodes;
        if (nodes.size > 0) {
          const nodesArray = Array.from(nodes.values());
          const mainNode = nodesArray[0];
          if (mainNode) {
            const isConnected = (mainNode as any).connected || 
                                (mainNode as any).state === 'CONNECTED' || 
                                (mainNode as any).status === 'CONNECTED';
            
            if (isConnected) {
              lavalinkStatus = '🟢 Conectado';
              
              const stats = (mainNode as any).stats || {};
              const info = (mainNode as any).info || {};
              lavalinkPing = stats.ping || info.ping || 'Desconhecido';
              
              if (typeof lavalinkPing === 'number') {
                lavalinkPing = lavalinkPing + 'ms';
              }
            } else {
              lavalinkStatus = '🟡 Disponível (não conectado)';
            }
          }
        }
      }
    } catch (error) {
      lavalinkStatus = '🔴 Erro: ' + (error instanceof Error ? error.message : String(error));
    }
    
    const uptime = formatUptime(client.uptime || 0);
    const memoryUsage = process.memoryUsage();
    const formattedMemory = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
    
    let embedColor: number;
    if (apiLatency < 100) {
      embedColor = 0x43B581;
    } else if (apiLatency < 200) {
      embedColor = 0xFAA61A; 
    } else {
      embedColor = 0xF04747;
    }
    
    const botAvatarURL = client.user?.displayAvatarURL({ size: 4096 }) || '';
    
    const embed = new EmbedBuilder()
      .setAuthor({ 
        name: 'Status do MiBot', 
        iconURL: botAvatarURL 
      })
      .setTitle('🏓 Estatísticas e Latência')
      .setColor(embedColor)
      .setDescription(`Monitoramento em tempo real do bot e seus serviços.`)
      .setThumbnail(botAvatarURL)
      .addFields(
        { 
          name: '⏱️ __Latência__', 
          value: `>>> 📶 **Discord API:** \`${apiLatency}ms\`\n🚀 **Resposta:** \`${responseTime}ms\`\n🎵 **Lavalink:** \`${lavalinkPing}\``,
          inline: true
        },
        { 
          name: '📊 __Status__', 
          value: `>>> ⏰ **Uptime:** \`${uptime}\`\n💾 **Memória:** \`${formattedMemory}MB\`\n🔄 **Players:** \`${client.lavalink.players?.size || 0}\``,
          inline: true 
        },
        { 
          name: '📡 __Conexões__', 
          value: `>>> 🎵 **Lavalink:** ${lavalinkStatus}\n🔌 **Nós:** \`${client.lavalink.nodeManager?.nodes.size || 0}\`\n👥 **Servidores:** \`${client.guilds.cache.size}\``,
          inline: false
        },
        {
          name: '🔧 __Versões__', 
          value: `>>> 📚 **Discord.js:** \`v${discordJSVersion}\`\n⚙️ **Node.js:** \`${process.version}\``,
          inline: false
        }
      )
      .setFooter({ 
        text: `Solicitado por ${context.isSlash ? context.interaction!.user.tag : context.message!.author.tag}`, 
        iconURL: context.isSlash 
          ? context.interaction!.user.displayAvatarURL({ size: 128 }) 
          : context.message!.author.displayAvatarURL({ size: 128 })
      })
      .setTimestamp();
    
    if (context.isSlash) {
      await context.interaction!.editReply({ content: null, embeds: [embed] });
    } else {
      await initialMessage.edit({ content: null, embeds: [embed] });
    }
  }
};

function formatUptime(uptime: number): string {
  const totalSeconds = Math.floor(uptime / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
}

export default command;