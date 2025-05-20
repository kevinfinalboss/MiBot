import chalk from 'chalk';

const prefix = chalk.gray('[MiBot]');

export const logger = {
  info: (msg: string) => console.log(`${prefix} ${chalk.blue('[INFO]')} ${msg}`),
  success: (msg: string) => console.log(`${prefix} ${chalk.green('[SUCCESS]')} ${msg}`),
  warn: (msg: string) => console.warn(`${prefix} ${chalk.yellow('[WARN]')} ${msg}`),
  error: (msg: string) => console.error(`${prefix} ${chalk.red('[ERROR]')} ${msg}`),
};
