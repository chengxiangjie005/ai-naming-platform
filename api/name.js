// 阶段1：单模型（豆包 / 火山方舟）AI 起名接口，SSE 流式输出 + Supabase 保存历史
const { createClient } = require('@supabase/supabase-js')

if (!process.env.VERCEL) {
  // 本地 vercel dev 时也稳妥加载 .env
  require('dotenv').config()
}

// ---------- 模型配置（阶段1 只有豆包一个模型） ----------
const MODEL_NAME = 'doubao'
const ARK_BASE_URL = process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v1'
const ARK_MODEL = process.env.DOUBAO_MODEL || 'doubao-seed-1-6-250615'

// ---------- Supabase ----------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

const SYSTEM_PROMPT = `你是一位精通中文姓名文化、音韵学与品牌命名的起名专家。
请严格按照下面的格式输出，不要输出多余的开场白和结束语：

## 方案一
**名字**：xxx
**寓意**：xxx（40-80字，说明字义、出处或文化内涵）
**适合**：xxx

## 方案二
（同上）

## 方案三
（同上）

要求：
1. 必须给出 3 组名字，名字要贴合用户给出的性别、风格、姓氏等信息；
2. 寓意解释要具体，避免空话套话，可引用诗词典故；
3. 名字不要生僻字，注意读音顺口、无明显谐音歧义。`

function buildUserPrompt(requirement) {
  return `请根据以下需求起名：${requirement}\n\n请给出 3 组名字方案，并附寓意解释。`
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: '请使用 POST 请求' })
    return
  }

  const { requirement } = req.body || {}
  if (!requirement || !requirement.trim()) {
    res.status(400).json({ error: '请填写起名需求' })
    return
  }

  if (!process.env.DOUBAO_API_KEY) {
    res.status(500).json({ error: '缺少 DOUBAO_API_KEY，请检查 .env 配置' })
    return
  }

  // 建立 SSE 连接
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  let fullText = ''
  let saved = false
  let historyId = null

  try {
    // 直接用官方 curl 示例对应的原始 HTTP 请求（不经过 SDK，便于看清底层）
    const upstream = await fetch(`${ARK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DOUBAO_API_KEY}`
      },
      body: JSON.stringify({
        model: ARK_MODEL,
        stream: true,
        temperature: 0.8,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(requirement) }
        ]
      })
    })

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text()
      res.write(`data: ${JSON.stringify({ type: 'error', message: `模型调用失败(${upstream.status})：${errText}` })}\n\n`)
      res.end()
      return
    }

    // 逐块解析上游 SSE，把 delta.content 转发给前端
    const reader = upstream.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // 最后一行可能不完整，留到下一轮

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') continue

        try {
          const json = JSON.parse(payload)
          const delta = json.choices?.[0]?.delta?.content || ''
          if (delta) {
            fullText += delta
            res.write(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`)
          }
        } catch (e) {
          // 忽略无法解析的注释行
        }
      }
    }

    // ---------- 写入 Supabase ----------
    if (fullText.trim()) {
      const { data, error } = await supabase
        .from('name_history')
        .insert({
          user_requirement: requirement.trim(),
          name_result: fullText,
          model_name: MODEL_NAME
        })
        .select('id')
        .single()

      if (error) {
        res.write(`data: ${JSON.stringify({ type: 'warn', message: `历史记录保存失败：${error.message}` })}\n\n`)
      } else {
        saved = true
        historyId = data?.id ?? null
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done', saved, historyId, model: MODEL_NAME })}\n\n`)
    res.end()
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: `服务异常：${err.message}` })}\n\n`)
    res.end()
  }
}
