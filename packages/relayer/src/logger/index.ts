import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json({
    replacer: (_key: string, value: unknown) => {
      return typeof value === 'bigint' ? value.toString(10): value;
    } 
  })
);

const logLevel = process.env.LOG_LEVEL || 'debug';

const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: {
    service: 'privacy-pools-relayer',
    version: process.env.npm_package_version || 'unknown',
  },
  transports: [
    new winston.transports.Console({
      level: logLevel,
    })
  ]
});

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-explicit-any
type ClassOrFn = Function | InstanceType<any>;

export const createModuleLogger = (classOrFnInstance: ClassOrFn, extraPrefixes: string[] = []) =>
logger.child({
  modulePrefix: `[${typeof classOrFnInstance === 'function' ? 
    classOrFnInstance.name : 
    classOrFnInstance.constructor.name}]${extraPrefixes.map((prefix) => `[${prefix}]`).join('')} `,
})

