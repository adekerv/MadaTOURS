// One shared Express application handles both local and serverless API requests.
import { createApp } from '../server/app.js';
export default createApp();
