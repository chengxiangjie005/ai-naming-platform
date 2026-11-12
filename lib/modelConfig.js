// 多模型配置表：新增模型只需在这里加一项配置，主调用代码（api/name.js）不用改
// 四家平台都提供 OpenAI 兼容网关，入参/SSE 返回/鉴权头完全一致
require('dotenv').config()

const modelConfigMap = {
  doubao: {
    label: '豆包（火山方舟）',
    baseURL: process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v1',
    apiKey: process.env.DOUBAO_API_KEY,
    model: process.env.DOUBAO_MODEL || 'doubao-seed-1-6-250615',
    extra: {}
  },
  deepseek: {
    label: 'DeepSeek',
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    extra: {}
  },
  qwen: {
    // 通义千问必须用 compatible-mode 地址，普通 dashscope 地址不兼容 OpenAI 协议
    label: '通义千问',
    baseURL: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY,
    model: process.env.QWEN_MODEL || 'qwen-plus',
    extra: { enable_thinking: false }
  },
  kimi: {
    label: 'Kimi（月之暗面）',
    baseURL: process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
    apiKey: process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY,
    model: process.env.KIMI_MODEL || 'moonshot-v1-8k',
    extra: {}
  },
  // OpenRouter：一把密钥聚合多家模型，有免费额度，无需实名与充值，适合本实验
  openrouter: {
    label: 'OpenRouter（文心 5.5 免费版）',
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || 'baidu/ernie-5.5-flash-preview:free',
    extra: {}
  },
  // 免密钥的 OpenAI 兼容公共接口，用于课堂演示 / 无密钥时兜底，正式上线建议删掉
  free: {
    label: '免费测试模型（免密钥）',
    baseURL: process.env.FREE_BASE_URL || 'https://text.pollinations.ai/openai',
    apiKey: process.env.FREE_API_KEY || '',
    model: process.env.FREE_MODEL || 'openai',
    requiresKey: false,
    extra: {}
  }
}

module.exports = { modelConfigMap }
