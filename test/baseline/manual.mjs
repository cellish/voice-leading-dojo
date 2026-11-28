// 手で作った解答（今の挙動の記録用。理論的な正しさは問わない）。
// 自動で作った解答は全17規則に当たるが、判定が怪しい箇所（PLAN.md に書いたもの）を、同じ形で何度でも確かめられるように置く。
export const MANUAL = [
    {
        id: 'manual/unison-parallel', exercise: 'custom', text: 'C  C3 D3',
        note: 'アルトとテノールが同度のまま並行して進む。今は「連続8度」と出る（同度として区別しない）',
        ans: [['G4', 'E4', 'E4'], ['A4', 'F4', 'F4']]
    },
    {
        id: 'manual/fifth-to-octave-hidden', exercise: 'custom', text: 'C  C3 D3',
        note: '外声が完全5度から完全8度へ、同じ方向に、ソプラノが跳躍して入る。今は hidden にも parallel にもならない',
        ans: [['G4', 'E4', 'C4'], ['D5', 'A4', 'F4']]
    },
    {
        id: 'manual/dim5-melodic', exercise: 'custom', text: 'C  G2 C3',
        note: 'ソプラノが減5度（シ→ファ）で進む。augMel は増2度・増4度だけなので出ない（D14 で直す対象）',
        ans: [['B4', 'G4', 'D4'], ['F5', 'E4', 'C4']]
    },
    {
        id: 'manual/aug5-melodic', exercise: 'custom', text: 'C  C3 E3:6',
        note: 'アルトが増5度（ド→ソ♯）で進む。augMel は増2度・増4度だけなので出ない（D14 で直す対象）',
        ans: [['G4', 'C4', 'E4'], ['G4', 'G♯4', 'E4']]
    }
];
