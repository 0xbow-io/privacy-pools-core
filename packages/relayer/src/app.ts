import bodyParser from "body-parser";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import {
  errorHandlerMiddleware,
  marshalResponseMiddleware,
  notFoundMiddleware,
} from "./middlewares/index.js";
import { relayerRouter } from "./routes/index.js";
import { CORS_ALLOW_ALL, ALLOWED_DOMAINS } from "./config/index.js";

// Initialize the express app
const app = express();

// Middleware functions
const parseJsonMiddleware = bodyParser.json();

// CORS config - allow all origins by default for development and testnet
const isTestnetRelayer = process.env.NODE_ENV === 'production' && 
  (process.env.RELAYER_HOST === 'testnet-relayer.privacypools.com' || 
   process.env.HOST === 'testnet-relayer.privacypools.com');

const shouldAllowAll = CORS_ALLOW_ALL || isTestnetRelayer;

const corsOptions = {
  origin: shouldAllowAll ? '*' : function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests without origin (like mobile apps) or from allowed domains
    if (!origin || ALLOWED_DOMAINS.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`Request blocked by CORS middleware: ${origin}. Allowed domains: ${ALLOWED_DOMAINS}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};


// Apply middleware and routes
app.use(cors(corsOptions));
app.use(parseJsonMiddleware);
app.use(marshalResponseMiddleware);

// ping route
app.use("/ping", (req: Request, res: Response, next: NextFunction) => {
  res.send("pong");
  next();
});

// relayer route
app.use("/relayer", relayerRouter);

// Error and 404 handling
app.use([errorHandlerMiddleware, notFoundMiddleware]);

export { app };
