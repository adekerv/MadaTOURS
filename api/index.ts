// One shared Express application handles both local and serverless API requests.
import { createApp } from '../server/app';
export default createApp();
