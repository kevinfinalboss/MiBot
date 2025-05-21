// Cores ANSI para console
const colors = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

const prefix = `${colors.gray}[MiBot]${colors.reset}`;

export const logger = {
  info: (msg: string) => console.log(`${prefix} ${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${prefix} ${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warn: (msg: string) => console.warn(`${prefix} ${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg: string) => console.error(`${prefix} ${colors.red}[ERROR]${colors.reset} ${msg}`),
};