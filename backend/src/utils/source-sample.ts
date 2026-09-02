/**
 * 超长原文采样：保留开头、中段与结尾三段摘录，供项目级 / 风格级分析节省上下文。
 * 原文仍完整保存在项目中，仅影响送入模型的上下文。
 */
export function sampleSourceContent(content: string, limit = 36_000) {
  if (content.length <= limit) return content
  const middle = Math.floor(content.length / 2)
  return [
    content.slice(0, 20_000),
    '\n\n【中段摘录】\n',
    content.slice(middle - 5_000, middle + 5_000),
    '\n\n【结尾摘录】\n',
    content.slice(-6_000),
  ].join('')
}
