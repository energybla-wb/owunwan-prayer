import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase.js";
import { doc, getDoc, runTransaction } from "firebase/firestore";

// 15주차 (2026.9.27 ~ 2027.1.9)
const WEEKS = [];
for (let i = 0; i < 15; i++) {
  const start = new Date(2026, 8, 27 + i * 7);
  const end = new Date(2026, 8, 27 + i * 7 + 6);
  const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  WEEKS.push({
    key: `week-${String(i + 1).padStart(2, "0")}`,
    label: `${i + 1}주`,
    fullLabel: `${i + 1}주차 (${fmt(start)} ~ ${fmt(end)})`,
    startDate: start,
    endDate: end,
  });
}

const ADMIN_NAME = "관리자";
const ADMIN_PASSWORD = "admin1234";

function hashPassword(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

function isWeekActive(week) {
  return week.startDate <= new Date();
}

function getDefaultWeek() {
  const active = WEEKS.filter(isWeekActive);
  return active.length > 0 ? active[active.length - 1].key : WEEKS[0].key;
}

export default function App() {
  const [view, setView] = useState("home");
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(getDefaultWeek());
  const [prayers, setPrayers] = useState({});
  const [announcements, setAnnouncements] = useState({});
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [loginName, setLoginName] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [prayerText, setPrayerText] = useState("");
  const [prayerPublic, setPrayerPublic] = useState(true);
  const [editingPrayer, setEditingPrayer] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [announcementText, setAnnouncementText] = useState("");
  const [editingAnnouncement, setEditingAnnouncement] = useState(false);
  const [commentTexts, setCommentTexts] = useState({});

  const showNotification = useCallback((msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const loadAllData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const allP = {}, allA = {};
    for (const w of WEEKS) {
      try { const s = await getDoc(doc(db, "prayers", w.key)); allP[w.key] = s.exists() ? s.data().items || [] : []; } catch { allP[w.key] = []; }
      try { const s = await getDoc(doc(db, "announcements", w.key)); allA[w.key] = s.exists() ? s.data().text || "" : ""; } catch { allA[w.key] = ""; }
    }
    setPrayers(allP); setAnnouncements(allA); setLoading(false);
  }, []);

  useEffect(() => { loadAllData(); }, [loadAllData]);
  useEffect(() => {
    if (view !== "main") return;
    const t = setInterval(() => loadAllData(true), 30000);
    return () => clearInterval(t);
  }, [view, loadAllData]);

  function doLogin() {
    const name = loginName.trim(), pw = loginPw.trim();
    if (!name || !pw) { showNotification("이름과 비밀번호를 입력해주세요.", "error"); return; }
    if (name === ADMIN_NAME && pw === ADMIN_PASSWORD) {
      setIsAdmin(true); setCurrentUser(null); setView("main");
      setLoginName(""); setLoginPw(""); showNotification("관리자로 로그인했습니다."); return;
    }
    setCurrentUser({ name, pw, pwHash: hashPassword(pw) });
    setIsAdmin(false); setView("main"); setLoginName(""); setLoginPw("");
    showNotification(`${name}님, 환영합니다.`);
  }

  function handleLogout() {
    setCurrentUser(null); setIsAdmin(false); setView("home");
    setEditingPrayer(null); setPrayerText(""); setPrayerPublic(true);
    setEditingAnnouncement(false); setAnnouncementText("");
  }

  async function saveAnnouncement() {
    if (submitting) return; setSubmitting(true);
    try {
      const ref = doc(db, "announcements", selectedWeek);
      await runTransaction(db, async (tx) => { tx.set(ref, { text: announcementText.trim(), updatedAt: new Date().toISOString() }); });
      await loadAllData(true); setEditingAnnouncement(false);
      showNotification("공통 기도제목이 저장되었습니다.");
    } catch { showNotification("저장 실패", "error"); } finally { setSubmitting(false); }
  }

  async function doSubmitPrayer() {
    if (!prayerText.trim()) { showNotification("기도제목을 입력해주세요.", "error"); return; }
    if (submitting) return; setSubmitting(true);
    const entry = { name: currentUser.name, pw: currentUser.pw, pwHash: currentUser.pwHash, text: prayerText.trim(), isPublic: prayerPublic, updatedAt: new Date().toISOString() };
    try {
      const ref = doc(db, "prayers", selectedWeek);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const cur = snap.exists() ? snap.data().items || [] : [];
        const idx = cur.findIndex((p) => p.name === currentUser.name && p.pwHash === currentUser.pwHash);
        entry.createdAt = idx >= 0 ? cur[idx].createdAt : new Date().toISOString();
        entry.comments = idx >= 0 ? cur[idx].comments || [] : [];
        const upd = idx >= 0 ? cur.map((p, i) => i === idx ? entry : p) : [...cur, entry];
        tx.set(ref, { items: upd });
      });
      await loadAllData(true); setPrayerText(""); setPrayerPublic(true); setEditingPrayer(null);
      showNotification("기도제목이 저장되었습니다.");
    } catch { showNotification("저장 실패", "error"); } finally { setSubmitting(false); }
  }

  async function handleDeletePrayer(weekKey, name, pwHash) {
    try {
      const ref = doc(db, "prayers", weekKey);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const cur = snap.exists() ? snap.data().items || [] : [];
        tx.set(ref, { items: cur.filter((p) => !(p.name === name && p.pwHash === pwHash)) });
      });
      await loadAllData(true); setDeleteConfirm(null); showNotification("삭제되었습니다.");
    } catch { showNotification("삭제 실패", "error"); }
  }

  async function handleDeleteUser(name, pwHash) {
    try {
      for (const w of WEEKS) {
        const ref = doc(db, "prayers", w.key);
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          const cur = snap.exists() ? snap.data().items || [] : [];
          const f = cur.filter((p) => !(p.name === name && p.pwHash === pwHash));
          if (f.length !== cur.length) tx.set(ref, { items: f });
        });
      }
      await loadAllData(true); setDeleteConfirm(null); showNotification(`${name}님의 모든 데이터가 삭제되었습니다.`);
    } catch { showNotification("삭제 실패", "error"); }
  }

  async function addComment(prayerName, prayerPwHash) {
    const ck = `${prayerName}-${prayerPwHash}`, text = (commentTexts[ck] || "").trim();
    if (!text || submitting) return; setSubmitting(true);
    const commenter = isAdmin ? "관리자" : currentUser.name;
    try {
      const ref = doc(db, "prayers", selectedWeek);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const cur = snap.exists() ? snap.data().items || [] : [];
        const upd = cur.map((p) => p.name === prayerName && p.pwHash === prayerPwHash
          ? { ...p, comments: [...(p.comments || []), { name: commenter, text, createdAt: new Date().toISOString() }] } : p);
        tx.set(ref, { items: upd });
      });
      await loadAllData(true); setCommentTexts((prev) => ({ ...prev, [ck]: "" })); showNotification("댓글이 등록되었습니다.");
    } catch { showNotification("댓글 등록 실패", "error"); } finally { setSubmitting(false); }
  }

  async function deleteComment(prayerName, prayerPwHash, ci) {
    try {
      const ref = doc(db, "prayers", selectedWeek);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const cur = snap.exists() ? snap.data().items || [] : [];
        const upd = cur.map((p) => p.name === prayerName && p.pwHash === prayerPwHash
          ? { ...p, comments: (p.comments || []).filter((_, i) => i !== ci) } : p);
        tx.set(ref, { items: upd });
      });
      await loadAllData(true); showNotification("댓글이 삭제되었습니다.");
    } catch {}
  }

  function startEdit(prayer) { setPrayerText(prayer.text); setPrayerPublic(prayer.isPublic); setEditingPrayer(prayer); }
  function canSeePrayer(p) { return p.isPublic || isAdmin || (currentUser && p.name === currentUser.name && p.pwHash === currentUser.pwHash); }
  function isOwner(p) { return currentUser && p.name === currentUser.name && p.pwHash === currentUser.pwHash; }

  const weekPrayers = (prayers[selectedWeek] || []).filter(canSeePrayer);
  const myPrayer = currentUser ? (prayers[selectedWeek] || []).find((p) => p.name === currentUser.name && p.pwHash === currentUser.pwHash) : null;
  const hasAnyActive = WEEKS.some(isWeekActive);
  const currentAnnouncement = announcements[selectedWeek] || "";

  return (
    <div style={S.app}>
      <style>{globalCSS}</style>

      {notification && (
        <div style={{ ...S.notification, background: notification.type === "error" ? "#8b1a1a" : "rgba(180,190,200,0.12)",
          borderLeft: notification.type === "error" ? "3px solid #c0392b" : "3px solid rgba(180,190,200,0.4)" }}>{notification.msg}</div>
      )}

      {deleteConfirm && (
        <div style={S.modalOverlay}><div style={S.modalBox}>
          <p style={S.modalText}>{deleteConfirm.type === "user" ? `"${deleteConfirm.name}"님의 모든 데이터를 삭제할까요?` : `"${deleteConfirm.name}"님의 기도제목을 삭제할까요?`}</p>
          <div style={S.modalBtns}>
            <button type="button" style={S.modalConfirmBtn} onClick={() => { deleteConfirm.type === "user" ? handleDeleteUser(deleteConfirm.name, deleteConfirm.pwHash) : handleDeletePrayer(deleteConfirm.weekKey, deleteConfirm.name, deleteConfirm.pwHash); }}>삭제</button>
            <button type="button" style={S.modalCancelBtn} onClick={() => setDeleteConfirm(null)}>취소</button>
          </div>
        </div></div>
      )}

      <header style={S.header}><div style={S.headerInner}>
        <div style={S.logoArea} onClick={() => { setView(currentUser || isAdmin ? "main" : "home"); setEditingPrayer(null); setEditingAnnouncement(false); }}>
          <span style={S.logoEmoji}>💪</span>
        </div>
        {(currentUser || isAdmin) && (
          <div style={S.headerRight}>
            <span style={S.userName}>{isAdmin ? "관리자" : currentUser?.name}</span>
            <button type="button" style={S.logoutBtn} onClick={handleLogout}>로그아웃</button>
          </div>
        )}
      </div></header>

      <main style={S.main}>
        {view === "home" && (
          <div style={S.homeContainer}>
            <div style={S.heroSection}>
              <p style={S.heroEmoji}>💪</p>
              <p style={S.heroTitle}>오운완</p>
              <p style={S.heroSub}>함께 기도해요</p>
            </div>
            <div style={S.loginCardWrap}><div style={S.loginCard}>
              <h2 style={S.cardTitle}>기도제목 나누기</h2>
              <p style={S.cardDesc}>이름과 비밀번호로 로그인하여 기도제목을 나눠주세요</p>
              <div style={S.formDiv}>
                <input style={S.input} placeholder="이름" value={loginName} onChange={(e) => setLoginName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doLogin(); }} />
                <input style={S.input} type="password" placeholder="비밀번호" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doLogin(); }} />
                <button type="button" style={S.primaryBtn} onClick={doLogin}>로그인</button>
              </div>
              <p style={S.loginHint}>* 처음 오시는 분은 이름과 비밀번호를 설정하시면 됩니다.<br />* 이후 같은 정보로 로그인하여 기도제목을 수정할 수 있습니다.</p>
            </div></div>
          </div>
        )}

        {view === "main" && (
          <div style={S.monthsContainer}>
            {!hasAnyActive && <div style={S.noActiveNotice}><p>2026년 9월 27일부터 시작됩니다.</p></div>}
            <div style={S.weekTabs}>
              {WEEKS.map((w) => {
                const active = isWeekActive(w), sel = selectedWeek === w.key;
                return (
                  <button key={w.key} type="button" disabled={!active}
                    onClick={() => { if (active) { setSelectedWeek(w.key); setEditingPrayer(null); setPrayerText(""); setPrayerPublic(true); setEditingAnnouncement(false); loadAllData(true); } }}
                    style={{ ...S.weekTab, ...(sel && active ? S.weekTabSelected : {}), ...(!active ? S.weekTabDisabled : {}) }}>
                    {w.label}
                  </button>
                );
              })}
            </div>
            {hasAnyActive && (
              <>
                <h2 style={S.weekTitle}>{WEEKS.find((w) => w.key === selectedWeek)?.fullLabel}</h2>

                {/* 공통 기도제목 */}
                <div style={S.announcementSection}>
                  <h3 style={S.sectionTitle}>📌 공통 기도제목</h3>
                  {isAdmin && !editingAnnouncement && (
                    <button type="button" style={S.editBtnSmall} onClick={() => { setAnnouncementText(currentAnnouncement); setEditingAnnouncement(true); }}>
                      {currentAnnouncement ? "수정" : "작성"}</button>
                  )}
                  {isAdmin && editingAnnouncement ? (
                    <div style={S.formDiv}>
                      <textarea style={S.textarea} placeholder="공통 기도제목을 작성해주세요..." value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} rows={3} />
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button type="button" style={{ ...S.primaryBtn, opacity: submitting ? 0.5 : 1 }} onClick={saveAnnouncement} disabled={submitting}>{submitting ? "저장 중..." : "저장"}</button>
                        <button type="button" style={S.cancelBtn} onClick={() => setEditingAnnouncement(false)}>취소</button>
                      </div>
                    </div>
                  ) : currentAnnouncement ? (
                    <p style={S.announcementText}>{currentAnnouncement}</p>
                  ) : (
                    <p style={S.announcementEmpty}>아직 공통 기도제목이 없습니다.</p>
                  )}
                </div>

                {/* 기도제목 작성 */}
                {currentUser && !myPrayer && !editingPrayer && (
                  <div style={S.writeSection}>
                    <h3 style={S.sectionTitle}>기도제목 작성</h3>
                    <div style={S.formDiv}>
                      <textarea style={S.textarea} placeholder="기도제목을 작성해주세요..." value={prayerText} onChange={(e) => setPrayerText(e.target.value)} rows={4} />
                      <div style={S.visibilityRow}>
                        <span style={S.visLabel}>공개 설정:</span>
                        <button type="button" onClick={() => setPrayerPublic(true)} style={{ ...S.visBtn, ...(prayerPublic ? S.visBtnActive : {}) }}>🌐 공개</button>
                        <button type="button" onClick={() => setPrayerPublic(false)} style={{ ...S.visBtn, ...(!prayerPublic ? S.visBtnPrivate : {}) }}>🔒 비공개</button>
                      </div>
                      <p style={S.visHint}>{prayerPublic ? "모든 사람이 볼 수 있습니다." : "관리자만 볼 수 있습니다."}</p>
                      <button type="button" style={{ ...S.primaryBtn, opacity: submitting ? 0.5 : 1 }} onClick={doSubmitPrayer} disabled={submitting}>{submitting ? "저장 중..." : "기도제목 등록"}</button>
                    </div>
                  </div>
                )}

                {/* 기도제목 수정 */}
                {currentUser && editingPrayer && (
                  <div style={S.writeSection}>
                    <h3 style={S.sectionTitle}>기도제목 수정</h3>
                    <div style={S.formDiv}>
                      <textarea style={S.textarea} value={prayerText} onChange={(e) => setPrayerText(e.target.value)} rows={4} />
                      <div style={S.visibilityRow}>
                        <span style={S.visLabel}>공개 설정:</span>
                        <button type="button" onClick={() => setPrayerPublic(true)} style={{ ...S.visBtn, ...(prayerPublic ? S.visBtnActive : {}) }}>🌐 공개</button>
                        <button type="button" onClick={() => setPrayerPublic(false)} style={{ ...S.visBtn, ...(!prayerPublic ? S.visBtnPrivate : {}) }}>🔒 비공개</button>
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button type="button" style={{ ...S.primaryBtn, opacity: submitting ? 0.5 : 1 }} onClick={doSubmitPrayer} disabled={submitting}>{submitting ? "저장 중..." : "수정 완료"}</button>
                        <button type="button" style={S.cancelBtn} onClick={() => { setEditingPrayer(null); setPrayerText(""); setPrayerPublic(true); }}>취소</button>
                      </div>
                    </div>
                  </div>
                )}

                {currentUser && myPrayer && !editingPrayer && (
                  <div style={S.myPrayerBanner}>
                    <p style={S.myPrayerLabel}>✓ 이번 주 기도제목이 등록되어 있습니다</p>
                    <button type="button" style={S.editBtnSmall} onClick={() => startEdit(myPrayer)}>수정하기</button>
                  </div>
                )}

                {/* 기도제목 목록 */}
                <div style={S.prayerList}>
                  <h3 style={S.sectionTitle}>기도제목 목록 <span style={S.countBadge}>{weekPrayers.length}</span></h3>
                  {loading ? <div style={S.emptyState}>불러오는 중...</div>
                  : weekPrayers.length === 0 ? <div style={S.emptyState}>아직 등록된 기도제목이 없습니다.</div>
                  : weekPrayers.map((prayer, idx) => {
                    const ck = `${prayer.name}-${prayer.pwHash}`;
                    return (
                      <div key={idx} style={S.prayerCard}>
                        <div style={S.prayerHeader}>
                          <div style={S.prayerNameRow}>
                            <div style={S.avatar}>{prayer.name.charAt(0)}</div>
                            <span style={S.prayerName}>{prayer.name}</span>
                            <span style={{ ...S.visBadge, background: prayer.isPublic ? "rgba(120,180,140,0.15)" : "rgba(180,100,90,0.15)", color: prayer.isPublic ? "#78b48c" : "#b4645a" }}>
                              {prayer.isPublic ? "공개" : "비공개"}</span>
                          </div>
                          {(isOwner(prayer) || isAdmin) && (
                            <div style={S.prayerActions}>
                              {isOwner(prayer) && <button type="button" style={S.actionBtn} onClick={() => startEdit(prayer)}>수정</button>}
                              <button type="button" style={{ ...S.actionBtn, color: "#b4645a" }}
                                onClick={() => setDeleteConfirm({ type: "prayer", weekKey: selectedWeek, name: prayer.name, pwHash: prayer.pwHash })}>삭제</button>
                            </div>
                          )}
                        </div>
                        <p style={S.prayerText}>{prayer.text}</p>
                        <p style={S.prayerDate}>{new Date(prayer.updatedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</p>

                        {/* 댓글 */}
                        <div style={S.commentSection}>
                          {(prayer.comments || []).length > 0 && (
                            <div style={S.commentList}>
                              {(prayer.comments || []).map((c, ci) => (
                                <div key={ci} style={S.commentItem}>
                                  <div style={S.commentTop}>
                                    <span style={S.commentName}>{c.name}</span>
                                    <span style={S.commentDate}>{new Date(c.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</span>
                                    {isAdmin && <button type="button" style={{ ...S.actionBtn, color: "#b4645a", fontSize: "11px" }} onClick={() => deleteComment(prayer.name, prayer.pwHash, ci)}>삭제</button>}
                                  </div>
                                  <p style={S.commentText}>{c.text}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {(currentUser || isAdmin) && (
                            <div style={S.commentInputRow}>
                              <input style={S.commentInput} placeholder="댓글을 입력하세요..." value={commentTexts[ck] || ""}
                                onChange={(e) => setCommentTexts((prev) => ({ ...prev, [ck]: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === "Enter") addComment(prayer.name, prayer.pwHash); }} />
                              <button type="button" style={S.commentBtn} onClick={() => addComment(prayer.name, prayer.pwHash)} disabled={submitting}>등록</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 나의 기록 */}
                {currentUser && (
                  <div style={S.historySection}>
                    <h3 style={S.sectionTitle}>나의 기도제목 기록</h3>
                    <div style={S.historyGrid}>
                      {WEEKS.filter(isWeekActive).map((w) => {
                        const mp = (prayers[w.key] || []).find((p) => p.name === currentUser.name && p.pwHash === currentUser.pwHash);
                        return (
                          <div key={w.key} style={{ ...S.historyCard, borderLeft: mp ? "3px solid rgba(160,170,180,0.5)" : "3px solid rgba(160,170,180,0.1)" }}>
                            <span style={S.historyWeek}>{w.fullLabel}</span>
                            {mp ? <p style={S.historyText}>{mp.text}</p> : <p style={S.historyEmpty}>미등록</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 관리자 사용자 목록 */}
                {isAdmin && (
                  <div style={S.historySection}>
                    <h3 style={S.sectionTitle}>👤 등록된 사용자 목록 (관리자 전용)</h3>
                    <div style={S.userListWrap}>
                      {(() => {
                        const um = {};
                        WEEKS.forEach((w) => (prayers[w.key] || []).forEach((p) => { if (p.pw) um[p.name + "|" + p.pwHash] = { name: p.name, pw: p.pw, pwHash: p.pwHash }; }));
                        const users = Object.values(um);
                        if (users.length === 0) return <p style={S.historyEmpty}>아직 등록된 사용자가 없습니다.</p>;
                        return users.map((u, i) => (
                          <div key={i} style={S.userRow}>
                            <div style={S.userRowInfo}><span style={S.userRowName}>{u.name}</span><span style={S.userRowPw}>{u.pw}</span></div>
                            <button type="button" style={{ ...S.actionBtn, color: "#b4645a" }} onClick={() => setDeleteConfirm({ type: "user", name: u.name, pwHash: u.pwHash })}>삭제</button>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <footer style={S.footer}><p style={S.footerText}>오운완 © 2026</p></footer>
    </div>
  );
}

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=Black+Han+Sans&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #1a1c20; }
  input, textarea, button { font-family: 'Noto Sans KR', sans-serif; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(160,170,180,0.2); border-radius: 3px; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
  button:hover { opacity: 0.85; }
  input:focus, textarea:focus { border-color: rgba(160,170,180,0.4) !important; outline: none; }
`;

const S = {
  app: { fontFamily: "'Noto Sans KR', sans-serif", background: "#1a1c20", color: "#c8ccd0", minHeight: "100vh", display: "flex", flexDirection: "column" },
  notification: { position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", padding: "12px 28px", borderRadius: "6px", fontSize: "14px", zIndex: 1000, animation: "slideDown 0.3s ease", backdropFilter: "blur(10px)", color: "#e0e2e6", maxWidth: "90vw", textAlign: "center" },
  header: { borderBottom: "1px solid rgba(160,170,180,0.1)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100, background: "rgba(26,28,32,0.95)" },
  headerInner: { maxWidth: "1100px", margin: "0 auto", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  logoArea: { cursor: "pointer", display: "flex", alignItems: "center" },
  logoEmoji: { fontSize: "28px", lineHeight: 1 },
  headerRight: { display: "flex", alignItems: "center", gap: "16px" },
  userName: { fontSize: "14px", color: "rgba(160,170,180,0.7)", fontWeight: 300 },
  logoutBtn: { background: "none", border: "1px solid rgba(160,170,180,0.2)", color: "rgba(160,170,180,0.6)", padding: "6px 16px", borderRadius: "4px", cursor: "pointer", fontSize: "13px" },
  main: { flex: 1, maxWidth: "1100px", margin: "0 auto", width: "100%", padding: "0 24px" },
  homeContainer: { animation: "fadeIn 0.6s ease" },
  heroSection: { textAlign: "center", padding: "70px 20px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" },
  heroEmoji: { fontSize: "72px", lineHeight: 1, marginBottom: "8px" },
  heroTitle: { fontFamily: "'Black Han Sans', sans-serif", fontSize: "clamp(40px, 10vw, 64px)", color: "#d0d4d8", letterSpacing: "6px", lineHeight: 1.1, textShadow: "0 2px 8px rgba(0,0,0,0.3)" },
  heroSub: { fontSize: "clamp(16px, 3vw, 22px)", fontWeight: 300, color: "rgba(160,170,180,0.5)", letterSpacing: "3px" },
  loginCardWrap: { maxWidth: "420px", margin: "30px auto 80px" },
  loginCard: { background: "rgba(160,170,180,0.04)", border: "1px solid rgba(160,170,180,0.1)", borderRadius: "8px", padding: "32px", animation: "fadeIn 0.6s ease" },
  cardTitle: { fontSize: "16px", fontWeight: 500, marginBottom: "8px", letterSpacing: "1px", color: "#d0d4d8" },
  cardDesc: { fontSize: "13px", color: "rgba(160,170,180,0.45)", marginBottom: "24px", lineHeight: 1.6, fontWeight: 300 },
  formDiv: { display: "flex", flexDirection: "column", gap: "12px" },
  input: { background: "rgba(160,170,180,0.06)", border: "1px solid rgba(160,170,180,0.12)", borderRadius: "4px", padding: "12px 16px", color: "#c8ccd0", fontSize: "14px", outline: "none", width: "100%" },
  textarea: { background: "rgba(160,170,180,0.06)", border: "1px solid rgba(160,170,180,0.12)", borderRadius: "4px", padding: "14px 16px", color: "#c8ccd0", fontSize: "14px", outline: "none", resize: "vertical", lineHeight: 1.7, minHeight: "100px", width: "100%" },
  primaryBtn: { background: "linear-gradient(135deg, rgba(140,150,160,0.15), rgba(100,110,120,0.1))", border: "1px solid rgba(160,170,180,0.25)", color: "#d0d4d8", padding: "12px 24px", borderRadius: "4px", cursor: "pointer", fontSize: "14px", fontWeight: 500, letterSpacing: "1px", marginTop: "4px" },
  cancelBtn: { background: "transparent", border: "1px solid rgba(160,170,180,0.12)", color: "rgba(160,170,180,0.5)", padding: "12px 24px", borderRadius: "4px", cursor: "pointer", fontSize: "14px" },
  loginHint: { fontSize: "12px", color: "rgba(160,170,180,0.3)", lineHeight: 1.8, marginTop: "12px", fontWeight: 300 },
  monthsContainer: { padding: "40px 0 80px", animation: "fadeIn 0.5s ease" },
  noActiveNotice: { textAlign: "center", padding: "60px 20px", color: "rgba(160,170,180,0.5)", fontSize: "16px", fontWeight: 300 },
  weekTabs: { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "32px", justifyContent: "center" },
  weekTab: { background: "rgba(160,170,180,0.05)", border: "1px solid rgba(160,170,180,0.1)", color: "rgba(160,170,180,0.5)", padding: "8px 16px", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: "0.5px" },
  weekTabSelected: { background: "linear-gradient(135deg, rgba(160,170,180,0.15), rgba(120,130,140,0.1))", borderColor: "rgba(160,170,180,0.35)", color: "#d0d4d8", fontWeight: 500 },
  weekTabDisabled: { opacity: 0.2, cursor: "not-allowed", background: "transparent" },
  weekTitle: { textAlign: "center", fontSize: "20px", fontWeight: 300, letterSpacing: "2px", marginBottom: "36px", color: "rgba(200,204,208,0.8)" },
  announcementSection: { background: "rgba(160,170,180,0.04)", border: "1px solid rgba(160,170,180,0.1)", borderLeft: "3px solid rgba(160,170,180,0.3)", borderRadius: "4px", padding: "24px 28px", marginBottom: "32px", position: "relative" },
  announcementText: { fontSize: "14px", lineHeight: 1.8, color: "rgba(200,204,208,0.75)", fontWeight: 300, whiteSpace: "pre-wrap", wordBreak: "break-word" },
  announcementEmpty: { fontSize: "13px", color: "rgba(160,170,180,0.2)", fontWeight: 300, fontStyle: "italic" },
  writeSection: { background: "rgba(160,170,180,0.04)", border: "1px solid rgba(160,170,180,0.08)", borderRadius: "8px", padding: "28px", marginBottom: "32px" },
  sectionTitle: { fontSize: "15px", fontWeight: 500, letterSpacing: "1px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px", color: "rgba(200,204,208,0.8)" },
  visibilityRow: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" },
  visLabel: { fontSize: "13px", color: "rgba(160,170,180,0.5)", fontWeight: 300 },
  visBtn: { background: "rgba(160,170,180,0.06)", border: "1px solid rgba(160,170,180,0.12)", color: "rgba(160,170,180,0.5)", padding: "8px 16px", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontFamily: "'Noto Sans KR', sans-serif" },
  visBtnActive: { background: "rgba(120,180,140,0.1)", borderColor: "rgba(120,180,140,0.3)", color: "#78b48c" },
  visBtnPrivate: { background: "rgba(180,100,90,0.08)", borderColor: "rgba(180,100,90,0.25)", color: "#b4645a" },
  visHint: { fontSize: "12px", color: "rgba(160,170,180,0.3)", fontWeight: 300 },
  myPrayerBanner: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(160,170,180,0.04)", border: "1px solid rgba(160,170,180,0.08)", borderRadius: "6px", padding: "16px 24px", marginBottom: "32px", flexWrap: "wrap", gap: "12px" },
  myPrayerLabel: { fontSize: "14px", color: "rgba(160,170,180,0.6)", fontWeight: 300 },
  editBtnSmall: { background: "rgba(160,170,180,0.08)", border: "1px solid rgba(160,170,180,0.15)", color: "rgba(200,204,208,0.7)", padding: "6px 16px", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontFamily: "'Noto Sans KR', sans-serif" },
  prayerList: { marginBottom: "48px" },
  countBadge: { fontSize: "12px", background: "rgba(160,170,180,0.1)", padding: "2px 10px", borderRadius: "12px", fontWeight: 400, color: "rgba(160,170,180,0.5)" },
  emptyState: { textAlign: "center", padding: "60px 20px", color: "rgba(160,170,180,0.2)", fontSize: "14px", fontWeight: 300 },
  prayerCard: { background: "rgba(160,170,180,0.03)", border: "1px solid rgba(160,170,180,0.07)", borderRadius: "6px", padding: "24px", marginBottom: "12px", animation: "fadeIn 0.4s ease" },
  prayerHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", flexWrap: "wrap", gap: "10px" },
  prayerNameRow: { display: "flex", alignItems: "center", gap: "10px" },
  avatar: { width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, rgba(160,170,180,0.12), rgba(120,130,140,0.06))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 500, color: "rgba(200,204,208,0.6)", flexShrink: 0 },
  prayerName: { fontSize: "15px", fontWeight: 500, color: "#d0d4d8" },
  visBadge: { fontSize: "11px", padding: "2px 8px", borderRadius: "3px", fontWeight: 400 },
  prayerActions: { display: "flex", gap: "8px" },
  actionBtn: { background: "none", border: "none", color: "rgba(160,170,180,0.4)", cursor: "pointer", fontSize: "12px", padding: "4px 8px", fontFamily: "'Noto Sans KR', sans-serif" },
  prayerText: { fontSize: "14px", lineHeight: 1.8, color: "rgba(200,204,208,0.65)", fontWeight: 300, whiteSpace: "pre-wrap", wordBreak: "break-word" },
  prayerDate: { fontSize: "12px", color: "rgba(160,170,180,0.2)", marginTop: "14px", fontWeight: 300 },
  commentSection: { marginTop: "16px", borderTop: "1px solid rgba(160,170,180,0.07)", paddingTop: "12px" },
  commentList: { marginBottom: "10px" },
  commentItem: { padding: "8px 0", borderBottom: "1px solid rgba(160,170,180,0.04)" },
  commentTop: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" },
  commentName: { fontSize: "12px", fontWeight: 500, color: "rgba(200,204,208,0.55)" },
  commentDate: { fontSize: "11px", color: "rgba(160,170,180,0.2)", fontWeight: 300 },
  commentText: { fontSize: "13px", lineHeight: 1.6, color: "rgba(200,204,208,0.5)", fontWeight: 300 },
  commentInputRow: { display: "flex", gap: "8px", alignItems: "center" },
  commentInput: { flex: 1, background: "rgba(160,170,180,0.05)", border: "1px solid rgba(160,170,180,0.1)", borderRadius: "4px", padding: "8px 12px", color: "#c8ccd0", fontSize: "13px", outline: "none" },
  commentBtn: { background: "rgba(160,170,180,0.08)", border: "1px solid rgba(160,170,180,0.15)", color: "rgba(200,204,208,0.6)", padding: "8px 16px", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontFamily: "'Noto Sans KR', sans-serif", flexShrink: 0 },
  historySection: { borderTop: "1px solid rgba(160,170,180,0.08)", paddingTop: "40px", marginBottom: "40px" },
  historyGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" },
  historyCard: { background: "rgba(160,170,180,0.03)", padding: "16px 20px", borderRadius: "4px" },
  historyWeek: { fontSize: "13px", fontWeight: 500, color: "rgba(160,170,180,0.5)", letterSpacing: "0.5px", display: "block", marginBottom: "8px" },
  historyText: { fontSize: "13px", lineHeight: 1.7, color: "rgba(200,204,208,0.55)", fontWeight: 300, whiteSpace: "pre-wrap", wordBreak: "break-word" },
  historyEmpty: { fontSize: "13px", color: "rgba(160,170,180,0.15)", fontWeight: 300, fontStyle: "italic" },
  userListWrap: { display: "flex", flexDirection: "column", gap: "8px" },
  userRow: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(160,170,180,0.04)", border: "1px solid rgba(160,170,180,0.08)", borderRadius: "4px", padding: "12px 16px", gap: "12px" },
  userRowInfo: { display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", flex: 1 },
  userRowName: { fontSize: "14px", fontWeight: 500, color: "rgba(200,204,208,0.8)" },
  userRowPw: { fontSize: "13px", fontWeight: 300, color: "rgba(160,170,180,0.4)", fontFamily: "monospace", letterSpacing: "1px" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, backdropFilter: "blur(4px)" },
  modalBox: { background: "#22242a", border: "1px solid rgba(160,170,180,0.12)", borderRadius: "8px", padding: "32px", maxWidth: "360px", width: "90%", textAlign: "center" },
  modalText: { fontSize: "15px", color: "rgba(200,204,208,0.85)", lineHeight: 1.7, marginBottom: "24px" },
  modalBtns: { display: "flex", gap: "12px", justifyContent: "center" },
  modalConfirmBtn: { background: "rgba(180,100,90,0.12)", border: "1px solid rgba(180,100,90,0.35)", color: "#b4645a", padding: "10px 24px", borderRadius: "4px", cursor: "pointer", fontSize: "14px", fontWeight: 500, fontFamily: "'Noto Sans KR', sans-serif" },
  modalCancelBtn: { background: "rgba(160,170,180,0.06)", border: "1px solid rgba(160,170,180,0.12)", color: "rgba(160,170,180,0.6)", padding: "10px 24px", borderRadius: "4px", cursor: "pointer", fontSize: "14px", fontFamily: "'Noto Sans KR', sans-serif" },
  footer: { borderTop: "1px solid rgba(160,170,180,0.06)", padding: "24px", textAlign: "center", marginTop: "auto" },
  footerText: { fontSize: "12px", color: "rgba(160,170,180,0.2)", letterSpacing: "2px", fontWeight: 300 },
};
