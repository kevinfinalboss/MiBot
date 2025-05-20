import { Event } from '../../types/Event';
import { AutocompleteInteraction, Interaction } from 'discord.js';
import { logger } from '../../utils/logger';

const event: Event<'interactionCreate'> = {
  name: 'interactionCreate',
  async execute(interaction: Interaction) {
    if (!interaction.isAutocomplete()) return;

    const autocompleteInteraction = interaction as AutocompleteInteraction;

    const focusedValue = autocompleteInteraction.options.getFocused();

    const choices = ['ping', 'help', 'ban', 'kick'];

    const filtered = choices.filter(choice => choice.startsWith(focusedValue));

    await autocompleteInteraction.respond(
      filtered.map(choice => ({ name: choice, value: choice }))
    ).catch((err) => logger.error(`Erro no autocomplete: ${err}`));
  },
};

export default event;
