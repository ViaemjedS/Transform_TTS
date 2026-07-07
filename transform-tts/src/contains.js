// 定义可用的说话人（音色）映射表，key 为显示名称，value 为 HuggingFace 上的说话人嵌入向量 ID
export const SPEAKERS = {
    // 美国女性 1 — 对应 CMU ARCTIC 数据集中的 SLT 说话人
    "US female 1": "cmu_us_slt_arctic-wav-arctic_a0001",
    // 美国女性 2 — 对应 CMU ARCTIC 数据集中的 CLB 说话人
    "US female 2": "cmu_us_clb_arctic-wav-arctic_a0001",
    // 美国男性 1 — 对应 CMU ARCTIC 数据集中的 BDL 说话人
    "US male 1": "cmu_us_bdl_arctic-wav-arctic_a0003",
    // 美国男性 2 — 对应 CMU ARCTIC 数据集中的 RMS 说话人
    "US male 2": "cmu_us_rms_arctic-wav-arctic_a0003",
    // 加拿大男性 — 对应 CMU ARCTIC 数据集中的 JMK 说话人
    "Canadian male": "cmu_us_jmk_arctic-wav-arctic_a0002",
    // 苏格兰男性 — 对应 CMU ARCTIC 数据集中的 AWB 说话人
    "Scottish male": "cmu_us_awb_arctic-wav-arctic_b0002",
    // 印度男性 — 对应 CMU ARCTIC 数据集中的 KSP 说话人
    "Indian male": "cmu_us_ksp_arctic-wav-arctic_a0007",
}
// 默认使用的说话人 ID（美国女性 SLT），在用户未选择音色时作为默认值
export const DEFAULT_SPEAKER = "cmu_us_slt_arctic-wav-arctic_a0001";