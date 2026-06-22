import { Language } from './types';

type Dict = Record<string, string>;

const vi: Dict = {
  appName: 'along 翻译',
  tagline: 'Phiên dịch giọng nói Việt ↔ Trung thời gian thực',

  // auth
  login: 'Đăng nhập',
  register: 'Đăng ký',
  username: 'Tên đăng nhập',
  password: 'Mật khẩu',
  yourLanguage: 'Ngôn ngữ của bạn',
  langVi: 'Tiếng Việt',
  langZh: 'Tiếng Trung',
  haveAccount: 'Đã có tài khoản? Đăng nhập',
  noAccount: 'Chưa có tài khoản? Đăng ký',
  pendingApproval: 'Tài khoản đã tạo, đang chờ chủ duyệt.',
  loggingIn: 'Đang đăng nhập…',

  // home
  online: 'Đang online',
  frequent: 'Hay liên lạc',
  searchPeople: 'Tìm người theo tên…',
  noOnline: 'Chưa có ai online',
  noFrequent: 'Chưa có liên lạc nào',
  call: 'Gọi',
  soloMode: 'Dùng chế độ dịch 1 máy',
  admin: 'Quản trị',
  logout: 'Đăng xuất',
  connecting: 'Đang kết nối…',

  // call
  calling: 'Đang gọi',
  ringing: 'Đang đổ chuông…',
  incomingCall: 'Cuộc gọi đến',
  accept: 'Nghe',
  reject: 'Từ chối',
  hangup: 'Cúp máy',
  inCall: 'Đang trong cuộc gọi với',
  youSaid: 'Bạn nói',
  translation: 'Bản dịch',
  callFailedOffline: 'Người này không online',
  callFailedBusy: 'Người này đang bận',
  callEnded: 'Đã kết thúc cuộc gọi',
  speaker: 'Loa ngoài',
  earpiece: 'Loa trong',

  // solo
  soloTitle: 'Dịch 1 máy',
  soloHint:
    'Bấm micro rồi nói. Nói tiếng Việt → ra tiếng Trung, nói tiếng Trung → ra tiếng Việt. Ngừng ~1 giây để đổi chiều.',
  tapToStart: 'Bấm để bắt đầu',
  tapToStop: 'Bấm để dừng',
  original: 'Bản gốc',
  back: '← Quay lại',

  // admin
  adminTitle: 'Quản trị tài khoản',
  status: 'Trạng thái',
  statusPending: 'Chờ duyệt',
  statusApproved: 'Đã duyệt',
  statusLocked: 'Đã khóa',
  approve: 'Duyệt',
  lock: 'Khóa',
  unlock: 'Mở khóa',
  delete: 'Xóa',
  confirmDelete: 'Xóa tài khoản này?',
  role: 'Vai trò',
  roleOwner: 'Chủ',
  roleUser: 'Người dùng',

  micPermission: 'Cần cho phép micro để dịch giọng nói.',
};

const zh: Dict = {
  appName: 'along 翻译',
  tagline: '越南语 ↔ 中文 实时语音翻译',

  login: '登录',
  register: '注册',
  username: '用户名',
  password: '密码',
  yourLanguage: '您的语言',
  langVi: '越南语',
  langZh: '中文',
  haveAccount: '已有账号？登录',
  noAccount: '没有账号？注册',
  pendingApproval: '账号已创建，等待管理员审核。',
  loggingIn: '正在登录…',

  online: '在线',
  frequent: '常用联系人',
  searchPeople: '按用户名搜索…',
  noOnline: '暂时无人在线',
  noFrequent: '暂无联系人',
  call: '呼叫',
  soloMode: '单机翻译模式',
  admin: '管理',
  logout: '退出',
  connecting: '连接中…',

  calling: '正在呼叫',
  ringing: '正在响铃…',
  incomingCall: '来电',
  accept: '接听',
  reject: '拒绝',
  hangup: '挂断',
  inCall: '通话中',
  youSaid: '您说',
  translation: '翻译',
  callFailedOffline: '对方不在线',
  callFailedBusy: '对方忙线中',
  callEnded: '通话已结束',
  speaker: '扬声器',
  earpiece: '听筒',

  soloTitle: '单机翻译',
  soloHint:
    '点击麦克风后说话。说越南语 → 输出中文，说中文 → 输出越南语。停顿约1秒即可切换方向。',
  tapToStart: '点击开始',
  tapToStop: '点击停止',
  original: '原文',
  back: '← 返回',

  adminTitle: '账号管理',
  status: '状态',
  statusPending: '待审核',
  statusApproved: '已通过',
  statusLocked: '已锁定',
  approve: '通过',
  lock: '锁定',
  unlock: '解锁',
  delete: '删除',
  confirmDelete: '确定删除此账号？',
  role: '角色',
  roleOwner: '管理员',
  roleUser: '用户',

  micPermission: '需要允许麦克风权限才能进行语音翻译。',
};

const dicts: Record<Language, Dict> = { vi, zh };

export function makeT(lang: Language) {
  const d = dicts[lang] ?? vi;
  return (key: keyof typeof vi): string => d[key] ?? vi[key] ?? String(key);
}

export type TFunc = ReturnType<typeof makeT>;
