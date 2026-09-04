// Cloudflare Worker 后端代码

function base64UrlToUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) buffer[i] = rawData.charCodeAt(i);
  return buffer;
}

function arrayBufferToBase64Url(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateVapidAuthHeader(audience, subject, publicKeyBase64, privateKeyBase64) {
  const header = { alg: 'ES256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject
  };

  const encHeader = arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${encHeader}.${encPayload}`;

  const rawPrivateKey = base64UrlToUint8Array(privateKeyBase64);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    rawPrivateKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const jwt = `${unsignedToken}.${arrayBufferToBase64Url(signature)}`;
  return `vapid t=${jwt}, k=${publicKeyBase64}`;
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // 1. 保存订阅（绑定 userId 与设备 endpoint）
    if (url.pathname === '/api/subscribe' && request.method === 'POST') {
      try {
        const body = await request.json();
        const userId = body.userId || 'common';
        const subscription = body.subscription || body;
        
        // 构造唯一 Key：sub:用户ID:哈希/UUID
        const subId = `sub:${userId}:${crypto.randomUUID()}`;
        await env.PUSH_SUBS.put(subId, JSON.stringify({ userId, subscription }));
        
        return new Response(JSON.stringify({ success: true, message: '订阅成功' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 2. 消息推送接口（支持指定用户 targetUser / userId 推送）
    if ((url.pathname === '/api/send' || url.pathname === '/api/send-notification') && request.method === 'POST') {
      try {
        const data = await request.json();
        const targetUser = data.userId || data.targetUser || data.target_user;
        const payloadText = JSON.stringify({
          title: data.title || '新消息',
          body: data.body || '',
          icon: data.icon || '/icon-web.png',
          url: data.url || '/',
          contactId: data.contactId || data.sender_id || ''
        });

        // 检索 KV 订阅列表
        const list = await env.PUSH_SUBS.list({ prefix: targetUser ? `sub:${targetUser}:` : 'sub:' });
        const results = [];

        for (const key of list.keys) {
          const itemStr = await env.PUSH_SUBS.get(key.name);
          if (!itemStr) continue;
          
          let parsed = JSON.parse(itemStr);
          const sub = parsed.subscription || parsed;
          if (!sub || !sub.endpoint) continue;

          try {
            const endpointUrl = new URL(sub.endpoint);
            const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
            
            const authHeader = await generateVapidAuthHeader(
              audience,
              env.VAPID_SUBJECT || 'mailto:admin@example.com',
              env.VAPID_PUBLIC_KEY,
              env.VAPID_PRIVATE_KEY
            );

            const pushRes = await fetch(sub.endpoint, {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'TTL': '86400',
                'Content-Type': 'text/plain;charset=UTF-8'
              },
              body: payloadText
            });

            // 设备失效时清理
            if (pushRes.status === 410 || pushRes.status === 404) {
              await env.PUSH_SUBS.delete(key.name);
            }
            results.push({ endpoint: sub.endpoint, status: pushRes.status });
          } catch (e) {
            results.push({ error: e.message });
          }
        }

        return new Response(JSON.stringify({ success: true, count: results.length, results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};