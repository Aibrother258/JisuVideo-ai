// SCRIPT 面板 Step1 分支裁决（PR #47 P2 评审修复：从 episode.vue 模板条件提为纯函数，
// 行为测试覆盖完整状态矩阵，防止「空内容 + 其他 Agent 运行」等组合在搬迁中退化）。
//
// 状态矩阵（与拆分前 master 语义逐一保持）：
//   step !== 1                                        -> 'editor'      （Step0 原始内容编辑器）
//   step === 1 && !hasContent && !running             -> 'empty-guide' （无已保存剧本且全部空闲：改写引导空态）
//   step === 1 && running && taskType==='script_rewriter' -> 'rewriting'（改写运行中：整块加载态）
//   其余（含无已保存剧本但其他 Agent 运行、已有剧本等）  -> 'editor'     （仍显示编辑器可手工编辑；
//                                                                   改写按钮的禁用由组件内
//                                                                   running/taskType 表达式负责）
export function resolveScriptPanelState({ step, hasContent, running, taskType }) {
  if (step !== 1) return 'editor'
  if (!hasContent && !running) return 'empty-guide'
  if (running && taskType === 'script_rewriter') return 'rewriting'
  return 'editor'
}
