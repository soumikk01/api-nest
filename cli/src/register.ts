/**
 * register.ts — This is the file that gets require()'d at the top of the
 * user's app entry point after running `api-monitor init`.
 *
 * It activates both the axios and fetch interceptors so every HTTP call
 * made by the user's dev app is captured and sent to the API Monitor backend.
 */
import { patchAxios } from './interceptor/axios';
import { patchFetch } from './interceptor/fetch';

patchAxios();
patchFetch();

console.log('[api-monitor] 🟢 Monitoring active — visit your dashboard to see live calls');
