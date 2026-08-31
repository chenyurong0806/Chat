// functions/api/userinfo.js
export async function onRequestGet(context) {
  // 如果你有 Cookie/Token 鉴权，可以在这里从 context.request.headers.get('Cookie') 中读取
  // 这里演示从 D1 读取示例默认登录用户，也可以直接返回登录态
  try {
    return new Response(JSON.stringify({
      loggedIn: true,
      data: {
        id: "user_chenzi",
        username: "橙子",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=chenzi"
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ loggedIn: false }), { status: 401 });
  }
}