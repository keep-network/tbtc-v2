import * as ff from '@google-cloud/functions-framework';

ff.http('check', (request: ff.Request, response: ff.Response) => {
  response.send('OK');
});