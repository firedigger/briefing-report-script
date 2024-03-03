import { app, InvocationContext, Timer } from '@azure/functions';
import { trigger } from '../function';

export async function timerTrigger(myTimer: Timer, context: InvocationContext): Promise<void> {
    await trigger();
}

if (process.env.AZURE_FUNCTIONS_ENVIRONMENT !== 'Development')
    app.timer('timerTrigger', {
        schedule: '0 0 6 * * 1-5',
        handler: timerTrigger
    });