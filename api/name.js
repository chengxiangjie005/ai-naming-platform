// 阶段2：多模型切换版 —— modelConfigMap 统一配置 + 一套共用调用代码
// 支持 doubao / deepseek / qwen / kimi，全部走 OpenAI 兼容接口，SSE 流式输出
const { createClient } = require('@supabase/supabase-js')
const { modelConfigMap } = require('../lib/modelConfig')

if (!process.env.VERCEL) {
  require('dotenv').config()
}

const DEFAULT_MODEL = 'doubao'

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

// ---------- 共用调用代码：所有模型走同一段 fetch + SSE 解析 ----------
async function streamChat(config, messages, onDelta) {
  const headers = { 'Content-Type': 'application/json' }
  // 免密钥的公共接口不带 Authorization 头；其余模型统一 Bearer 鉴权
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`

  const upstream = await fetch(`${config.baseURL}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      stream: true,
      temperature: 0.8,
      messages,
      ...config.extra
    })
  })

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text()
    throw new Error(`模型调用失败(${upstream.status})：${errText.slice(0, 300)}`)
  }

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') continue

      try {
        const json = JSON.parse(payload)
        const delta = json.choices?.[0]?.delta?.content || ''
        if (delta) onDelta(delta)
      } catch (e) {
        // 忽略心跳/注释行
      }
    }
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: '请使用 POST 请求' })
    return
  }

  const { requirement, model } = req.body || {}
  if (!requirement || !requirement.trim()) {
    res.status(400).json({ error: '请填写起名需求' })
    return
  }

  const modelKey = model && modelConfigMap[model] ? model : DEFAULT_MODEL
  const config = modelConfigMap[modelKey]

  if (config.requiresKey !== false && !config.apiKey) {
    res.status(500).json({ error: `模型 ${modelKey} 缺少密钥，请检查环境变量配置` })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  let fullText = ''

  try {
    await streamChat(
      config,
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `请根据以下需求起名：${requirement.trim()}\n\n请给出 3 组名字方案，并附寓意解释。` }
      ],
      (delta) => {
        fullText += delta
        res.write(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`)
      }
    )

    // ---------- 写入 Supabase 历史记录 ----------
    let saved = false
    let historyId = null

    if (fullText.trim()) {
      const { data, error } = await supabase
        .from('name_history')
        .insert({
          user_requirement: requirement.trim(),
          name_result: fullText,
          model_name: modelKey
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

    res.write(`data: ${JSON.stringify({ type: 'done', saved, historyId, model: modelKey })}\n\n`)
    res.end()
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: `服务异常：${err.message}` })}\n\n`)
    res.end()
  }
}
