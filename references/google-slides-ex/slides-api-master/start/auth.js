const fs = require('fs');
const http = require('http');
const readline = require('readline');
const { URL } = require('url');
const googleAuth = require('google-auth-library');
const { openInBrowser } = require('./browser');
const TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
      process.env.USERPROFILE) + '/.credentials/';
const TOKEN_PATH = TOKEN_DIR + 'slides.googleapis.com-nodejs-quickstart.json';

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/slides.googleapis.com-nodejs-quickstart.json
const SCOPES = [
  'https://www.googleapis.com/auth/presentations', // needed to create slides
  'https://www.googleapis.com/auth/drive', // read and write files
  'https://www.googleapis.com/auth/bigquery.readonly' // needed for bigquery
];

/**
 * Loads client secrets from a local file.
 * @return {Promise} A promise to return the secrets.
 */
module.exports.getClientSecrets = () => {
  return new Promise((resolve, reject) => {
    fs.readFile('client_secret.json', (err, content) => {
      if (err) return reject('Error loading client secret file: ' + err);
      console.log('loaded secrets...');
      resolve(JSON.parse(content));
    });
  });
}

/**
 * Create an OAuth2 client promise with the given credentials.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback for the authorized client.
 * @return {Promise} A promise to return the OAuth client.
 */
module.exports.authorize = (credentials) => {
  return new Promise((resolve, reject) => {
    console.log('authorizing...');
    const oauthConfig = getOAuthConfig(credentials);
    if (oauthConfig instanceof Error) {
      return reject(oauthConfig);
    }

    const clientSecret = oauthConfig.client_secret;
    const clientId = oauthConfig.client_id;
    const redirectUrl = oauthConfig.redirect_uris[0];
    const auth = new googleAuth();
    const oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) {
        getNewToken(oauth2Client, redirectUrl).then(() => {
          resolve(oauth2Client);
        });
      } else {
        oauth2Client.credentials = JSON.parse(token);
        resolve(oauth2Client);
      }
    });
  });
}

function getOAuthConfig(credentials) {
  const oauthConfig = credentials.installed || credentials.web;
  if (!oauthConfig) {
    return new Error(
      'client_secret.json must contain either an "installed" or "web" OAuth client.'
    );
  }

  if (!oauthConfig.client_id || !oauthConfig.client_secret) {
    return new Error(
      'client_secret.json is missing client_id or client_secret.'
    );
  }

  if (!oauthConfig.redirect_uris || oauthConfig.redirect_uris.length === 0) {
    return new Error(
      'client_secret.json is missing redirect_uris. In Google Cloud, create an OAuth client for a Desktop app and download that JSON into client_secret.json.'
    );
  }

  return oauthConfig;
}

/**
 * Get and store new token after prompting for user authorization, and then
 * fulfills the promise. Modifies the `oauth2Client` object.
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @return {Promise} A promise to modify the oauth2Client credentials.
 */
function getNewToken(oauth2Client, redirectUrl) {
  console.log('getting new auth token...');
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });

  console.log('Authorization URL:', authUrl);
  const parsedRedirect = tryParseUrl(redirectUrl);
  const codePromise = parsedRedirect && isLocalRedirect(parsedRedirect) ?
    listenForAuthorizationCode(parsedRedirect).catch((err) => {
      console.error('Local callback listener was unavailable:', err.message);
      console.error('Falling back to manual code entry.');
      return promptForAuthorizationCode()();
    }) :
    promptForAuthorizationCode()();

  openInBrowser(authUrl).catch((err) => {
    console.error('Unable to open the authorization page automatically:', err.message);
    console.error('Open the URL above in your browser to continue.');
  });

  console.log(''); // \n
  return codePromise.then((code) => new Promise((resolve, reject) => {
    oauth2Client.getToken(code, (err, token) => {
      if (err) return reject(err);
      oauth2Client.credentials = token;
      let storeTokenErr = storeToken(token);
      if (storeTokenErr) return reject(storeTokenErr);
      resolve();
    });
  }));
}

function listenForAuthorizationCode(parsedRedirect) {
  const hostname = parsedRedirect.hostname;
  const port = parsedRedirect.port ? Number(parsedRedirect.port) : 80;
  const pathname = parsedRedirect.pathname || '/';

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqUrl = tryParseUrl(`http://${req.headers.host}${req.url}`);
      const code = reqUrl && reqUrl.searchParams.get('code');
      const authError = reqUrl && reqUrl.searchParams.get('error');

      if (reqUrl && reqUrl.pathname !== pathname) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }

      if (authError) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(`Authorization failed: ${authError}`);
        cleanup(() => reject(new Error(`Authorization failed: ${authError}`)));
        return;
      }

      if (!code) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Authorization code not found in callback URL.');
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<html><body><h2>Authorization received.</h2><p>You can close this tab and return to the terminal.</p></body></html>');
      cleanup(() => resolve(code));
    });

    function cleanup(done) {
      server.close(() => {
        done();
      });
    }

    server.on('error', reject);
    server.listen(port, hostname, () => {
      console.log(`Waiting for Google OAuth callback on ${parsedRedirect.origin}${pathname}`);
    });
  });
}

function promptForAuthorizationCode() {
  console.log('After approving access, paste either the full redirected URL or just the code value.');
  return () => new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('Enter the code or redirected URL here: ', (input) => {
      rl.close();
      resolve(extractAuthorizationCode(input));
    });
  });
}

function extractAuthorizationCode(input) {
  const trimmed = input.trim();
  const parsedUrl = tryParseUrl(trimmed);
  if (parsedUrl) {
    return parsedUrl.searchParams.get('code') || trimmed;
  }

  return trimmed;
}

function tryParseUrl(value) {
  try {
    return new URL(value);
  } catch (err) {
    return null;
  }
}

function isLocalRedirect(parsedRedirect) {
  return parsedRedirect.protocol === 'http:' && (
    parsedRedirect.hostname === 'localhost' ||
    parsedRedirect.hostname === '127.0.0.1' ||
    parsedRedirect.hostname === '[::1]'
  );
}

/**
 * Store token to disk be used in later program executions.
 * @param {Object} token The token to store to disk.
 * @return {Error?} Returns an error or undefined if there is no error.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
  } catch (err) {
    if (err.code != 'EEXIST') return err;
  }
  console.log('Token stored to ' + TOKEN_PATH);
}
