import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { trigger } from '../function';

export async function httpTrigger(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    await trigger(true, context);
    return {
        status: 200,
        body: 'OK',
    };
}

app.http('httpTrigger', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: httpTrigger
});