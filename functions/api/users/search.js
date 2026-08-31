// functions/api/users/search.js
export async function onRequestGet(context) {
  // 1. 获取前端传来的查询参数 ?username=xxx
  const { searchParams } = new URL(context.request.url);
  const username = searchParams.get('username');

  // 参数校验
  if (!username) {
    return new Response(JSON.stringify({ success: false, message: '请输入要查询的用户名' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // 2. context.env.DB 就是绑定的 D1 数据库实例
    // 注意：假设你的 D1 数据库中用户表名为 users，包含 id, username, avatar 字段
    const user = await context.env.DB.prepare(
      'SELECT id, username, avatar FROM users WHERE username = ? LIMIT 1'
    )
    .bind(username)
    .first();

    // 3. 如果没找到用户，返回 404
    if (!user) {
      return new Response(JSON.stringify({ success: false, message: '用户不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. 找到用户，安全返回给前端
    return new Response(JSON.stringify({ 
      success: true, 
      data: {
        id: user.id || `user_${user.username}`,
        username: user.username,
        avatar: user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // 数据库报错处理
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}