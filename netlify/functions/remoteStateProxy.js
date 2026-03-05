/**
 * Netlify Function: remoteStateProxy
 *
 * Fetches the remote JSON server-side so the browser never talks to Google Drive directly.
 * This avoids client-side CORS / 403 issues for publicly shared Drive files.
 */

const ALLOWED_HOSTS = new Set(['drive.google.com', 'docs.googleusercontent.com']);

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: ''
    };
  }

  try {
    const urlParam = event.queryStringParameters?.url;
    if (!urlParam) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'Missing url parameter.' })
      };
    }

    const url = new URL(urlParam);
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'URL is not allowed.' })
      };
    }

    // Remove local cache-busting params before forwarding upstream.
    url.searchParams.delete('cb');

    const res = await fetch(url.toString(), {
      redirect: 'follow',
      headers: {
        Accept: 'application/json,text/plain,*/*',
        'User-Agent': 'NetlifyFunction/remoteStateProxy'
      }
    });

    const text = await res.text();

    if (!res.ok) {
      return {
        statusCode: res.status,
        headers: corsHeaders(),
        body: JSON.stringify({ error: `Upstream fetch failed (${res.status})`, details: text.slice(0, 300) })
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      },
      body: text
    };
  } catch (error) {
    console.error('remoteStateProxy error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Proxy failed.' })
    };
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };
}
