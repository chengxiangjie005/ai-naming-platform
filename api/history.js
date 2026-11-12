// 历史记录查询接口：返回最近 20 条起名记录
const { createClient } = require('@supabase/supabase-js')

if (!process.env.VERCEL) {
  require('dotenv').config()
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

module.exports = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('name_history')
      .select('id, user_requirement, name_result, model_name, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      res.status(500).json({ error: error.message, items: [] })
      return
    }
    res.status(200).json({ items: data || [] })
  } catch (err) {
    res.status(500).json({ error: err.message, items: [] })
  }
}
