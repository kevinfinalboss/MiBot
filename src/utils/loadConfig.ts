import fs from 'fs';
import yaml from 'js-yaml';
import dotenv from 'dotenv';

dotenv.config();

function parseEnvVariables(obj: any): any {
  if (typeof obj === 'string') {
    const match = obj.match(/^\${(.+)}$/);
    if (match) {
      const envVar = match[1];
      const value = process.env[envVar];
      if (value === undefined) {
        throw new Error(`Variável de ambiente "${envVar}" não encontrada no .env`);
      }
      return value;
    }
    return obj;
  } else if (Array.isArray(obj)) {
    return obj.map(parseEnvVariables);
  } else if (typeof obj === 'object' && obj !== null) {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = parseEnvVariables(obj[key]);
    }
    return newObj;
  }
  return obj;
}

export function loadConfig<T>(path: string): T {
  const file = fs.readFileSync(path, 'utf8');
  const parsed = yaml.load(file);
  return parseEnvVariables(parsed) as T;
}
