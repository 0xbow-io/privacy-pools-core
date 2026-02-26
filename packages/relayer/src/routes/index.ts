import { Router } from "express";
import {
  relayerDetailsHandler,
  relayQuoteHandler,
  relayRequestHandler,
} from "../handlers/index.js";
import {
  validateDetailsMiddleware,
  validateQuoteMiddleware,
  validateRelayRequestMiddleware
} from "../middlewares/relayer/request.js";

// Router setup
const relayerRouter = Router();

relayerRouter.get("/details", [
  validateDetailsMiddleware,
  relayerDetailsHandler
]);

relayerRouter.post("/request", [
  validateRelayRequestMiddleware,
  relayRequestHandler,
]);

relayerRouter.post("/quote", [
  validateQuoteMiddleware,
  relayQuoteHandler
]);


export { relayerRouter };
