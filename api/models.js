// 模型列表接口：前端下拉框从这里读取，未配置密钥的模型会标记为不可用
const { modelConfigMap } = require('../lib/modelConfig')

module.exports = async (req, res) => {
  const items = Object.entries(modelConfigMap).map(([key, cfg]) => ({
    key,
    label: cfg.label,
    model: cfg.model,
    available: Boolean(cfg.apiKey)
  }))
  res.status(200).json({ items })
}
