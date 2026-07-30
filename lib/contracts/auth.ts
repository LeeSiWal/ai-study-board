import { z } from "zod";

/**
 * 회원가입 계약 — UI 명세 §7의 AUTH-02
 *
 * 오류 문구를 스키마에 둔다. 화면과 API가 같은 문장을 쓰게 되고, 문구를
 * 고칠 때 한 곳만 보면 된다.
 */
export const registerSchema = z.object({
  email: z.email({ message: "이메일 형식을 확인해주세요." }),
  displayName: z
    .string()
    .trim()
    .min(1, { message: "이름을 입력해주세요." })
    .max(30, { message: "이름은 30자를 넘을 수 없습니다." }),
  password: z
    .string()
    .min(8, { message: "비밀번호는 8자 이상이어야 합니다." })
    .max(200, { message: "비밀번호가 너무 깁니다." }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * 협업 커서 색 팔레트 — UI 명세 §3
 *
 * 겹치면 누가 누구인지 헷갈린다. 이름을 함께 보여주므로 색만으로 사람을
 * 구분하지는 않지만(§26), 그래도 다른 편이 낫다.
 */
export const CURSOR_COLORS = [
  "#4F67E8",
  "#218A61",
  "#B7791F",
  "#C94343",
  "#6756D8",
  "#0E7C8A",
  "#8A5CF6",
  "#D1547B",
  "#2F855A",
  "#DD6B20",
] as const;
