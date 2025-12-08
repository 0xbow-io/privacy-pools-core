import bodyParser from "body-parser";
import cors from "cors";
import express, { Express, NextFunction, Request, Response } from "express";
import { RelayerConfig } from "./config/index.js";
import { createModuleLogger } from "./logger/index.js";
import { adminMiddleware } from "./middlewares/admin/admin.middleware.js";
import {
  errorHandlerMiddleware,
  marshalResponseMiddleware,
  notFoundMiddleware,
} from "./middlewares/index.js";
import { adminRouter, relayerRouter } from "./routes/index.js";

const logger = createModuleLogger(express);

// CORS config - allow all origins by default for development and testnet
function corsOptions(allowedDomains: string[], corsAllowAll: boolean) {
  const isTestnetRelayer = process.env.NODE_ENV === 'production' &&
    (process.env.RELAYER_HOST === 'testnet-relayer.privacypools.com' ||
      process.env.HOST === 'testnet-relayer.privacypools.com');

  const shouldAllowAll = corsAllowAll || isTestnetRelayer;

  return {
    origin: shouldAllowAll ? '*' : function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      // Allow requests without origin (like mobile apps) or from allowed domains
      if (!origin || allowedDomains.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        logger.warn('Request blocked by CORS middleware', { origin, allowedDomains });
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200
  };

}

export async function createApp(): Promise<Express> {
  // Initialize the express app
  const app: Express = express();

  app.use(bodyParser.json());
  app.use(marshalResponseMiddleware);
  const config = new RelayerConfig();

  const {
    allowed_domains,
    cors_allow_all
  } = await config.fullConfig();

  app.use(cors(corsOptions(allowed_domains, cors_allow_all)));

  // ping route
  app.use("/ping", (req: Request, res: Response, next: NextFunction) => {
    res.send("pong");
    next();
  });

  // relayer route
  app.use("/relayer", relayerRouter());

  // admin route
  app.use("/admin", adminMiddleware, adminRouter());

  // Error and 404 handling
  app.use([errorHandlerMiddleware, notFoundMiddleware]);

  return app;
}
