/**
 * 从文本模型输出中解析 JSON 对象
 * 容错：去掉 Markdown 代码块围栏与前后杂讯，取首个 { 到末尾 } 的片段。
 * 项目分析、风格扩写等「单次对话返回一个 JSON」的 Agent 统一从这里解析。
 */
export function parseJsonObject(text: string): Record<string, any> {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = normalized.indexOf('{')
  const end = normalized.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('AI 未返回有效的 JSON 结果')
  return JSON.parse(normalized.slice(start, end + 1))
}
