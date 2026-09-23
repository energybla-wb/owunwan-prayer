import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase.js";
import { doc, getDoc, runTransaction } from "firebase/firestore";

const MONTHS = [
  { key: "2026-04", label: "4월", fullLabel: "2026년 4월" },
  { key: "2026-05", label: "5월", fullLabel: "2026년 5월" },
  { key: "2026-06", label: "6월", fullLabel: "2026년 6월" },
  { key: "2026-07", label: "7월", fullLabel: "2026년 7월" },
  { key: "2026-08", label: "8월", fullLabel: "2026년 8월" },
  { key: "2026-09", label: "9월", fullLabel: "2026년 9월" },
  { key: "2026-10", label: "10월", fullLabel: "2026년 10월" },
  { key: "2026-11", label: "11월", fullLabel: "2026년 11월" },
  { key: "2026-12", label: "12월", fullLabel: "2026년 12월" },
];

const ADMIN_NAME = "관리자";
const ADMIN_PASSWORD = "admin1234";

function hashPassword(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function isMonthActive(monthKey) {
  const now = new Date();
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1) <= now;
}

function getDefaultMonth() {
  const active = MONTHS.filter((m) => isMonthActive(m.key));
  return active.length > 0 ? active[active.length - 1].key : MONTHS[0].key;
}

export default function App() {
  const [view, setView] = useState("home");
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth());
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

  // 공통 기도제목 관련
  const [announcementText, setAnnouncementText] = useState("");
  const [editingAnnouncement, setEditingAnnouncement] = useState(false);

  // 댓글 관련
  const [commentTexts, setCommentTexts] = useState({});

  const showNotification = useCallback((msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // --- 데이터 로드 ---
  const loadAllData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const allPrayers = {};
    const allAnnouncements = {};
    for (const m of MONTHS) {
      try {
        const pSnap = await getDoc(doc(db, "prayers", m.key));
        allPrayers[m.key] = pSnap.exists() ? pSnap.data().items || [] : [];
      } catch { allPrayers[m.key] = []; }
      try {
        const aSnap = await getDoc(doc(db, "announcements", m.key));
        allAnnouncements[m.key] = aSnap.exists() ? aSnap.data().text || "" : "";
      } catch { allAnnouncements[m.key] = ""; }
    }
    setPrayers(allPrayers);
    setAnnouncements(allAnnouncements);
    setLoading(false);
  }, []);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  useEffect(() => {
    if (view !== "months") return;
    const interval = setInterval(() => { loadAllData(true); }, 30000);
    return () => clearInterval(interval);
  }, [view, loadAllData]);

  // --- 로그인 ---
  function doLogin() {
    const name = loginName.trim();
    const pw = loginPw.trim();
    if (!name || !pw) { showNotification("이름과 비밀번호를 입력해주세요.", "error"); return; }
    if (name === ADMIN_NAME && pw === ADMIN_PASSWORD) {
      setIsAdmin(true); setCurrentUser(null); setView("months");
      setLoginName(""); setLoginPw("");
      showNotification("관리자로 로그인했습니다."); return;
    }
    setCurrentUser({ name, pw, pwHash: hashPassword(pw) });
    setIsAdmin(false); setView("months");
    setLoginName(""); setLoginPw("");
    showNotification(`${name}님, 환영합니다.`);
  }

  function handleLogout() {
    setCurrentUser(null); setIsAdmin(false); setView("home");
    setEditingPrayer(null); setPrayerText(""); setPrayerPublic(true);
    setEditingAnnouncement(false); setAnnouncementText("");
  }

  // --- 공통 기도제목 (관리자 전용) ---
  async function saveAnnouncement() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const ref = doc(db, "announcements", selectedMonth);
      await runTransaction(db, async (transaction) => {
        transaction.set(ref, { text: announcementText.trim(), updatedAt: new Date().toISOString() });
      });
      await loadAllData(true);
      setEditingAnnouncement(false);
      showNotification("공통 기도제목이 저장되었습니다.");
    } catch (e) {
      console.error(e);
      showNotification("저장 중 오류가 발생했습니다.", "error");
    } finally { setSubmitting(false); }
  }

  // --- 기도제목 CRUD (트랜잭션) ---
  async function doSubmitPrayer() {
    if (!prayerText.trim()) { showNotification("기도제목을 입력해주세요.", "error"); return; }
    if (submitting) return;
    setSubmitting(true);
    const entry = {
      name: currentUser.name, pw: currentUser.pw, pwHash: currentUser.pwHash,
      text: prayerText.trim(), isPublic: prayerPublic,
      updatedAt: new Date().toISOString(),
    };
    try {
      const ref = doc(db, "prayers", selectedMonth);
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        const current = snap.exists() ? snap.data().items || [] : [];
        const idx = current.findIndex((p) => p.name === currentUser.name && p.pwHash === currentUser.pwHash);
        entry.createdAt = idx >= 0 ? current[idx].createdAt : new Date().toISOString();
        entry.comments = idx >= 0 ? current[idx].comments || [] : [];
        let updated;
        if (idx >= 0) { updated = [...current]; updated[idx] = entry; }
        else { updated = [...current, entry]; }
        transaction.set(ref, { items: updated });
      });
      await loadAllData(true);
      setPrayerText(""); setPrayerPublic(true); setEditingPrayer(null);
      showNotification("기도제목이 저장되었습니다.");
    } catch (e) {
      console.error(e);
      showNotification("저장 중 오류가 발생했습니다.", "error");
    } finally { setSubmitting(false); }
  }

  async function handleDeletePrayer(monthKey, prayerName, prayerPwHash) {
    try {
      const ref = doc(db, "prayers", monthKey);
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        const current = snap.exists() ? snap.data().items || [] : [];
        transaction.set(ref, { items: current.filter((p) => !(p.name === prayerName && p.pwHash === prayerPwHash)) });
      });
      await loadAllData(true);
      setDeleteConfirm(null);
      showNotification("기도제목이 삭제되었습니다.");
    } catch (e) { console.error(e); showNotification("삭제 중 오류가 발생했습니다.", "error"); }
  }

  async function handleDeleteUser(name, pwHash) {
    try {
      for (const m of MONTHS) {
        const ref = doc(db, "prayers", m.key);
        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(ref);
          const current = snap.exists() ? snap.data().items || [] : [];
          const filtered = current.filter((p) => !(p.name === name && p.pwHash === pwHash));
          if (filtered.length !== current.length) transaction.set(ref, { items: filtered });
        });
      }
      await loadAllData(true);
      setDeleteConfirm(null);
      showNotification(`${name}님의 모든 데이터가 삭제되었습니다.`);
    } catch (e) { console.error(e); showNotification("삭제 중 오류가 발생했습니다.", "error"); }
  }

  // --- 댓글 ---
  async function addComment(prayerName, prayerPwHash) {
    const key = `${prayerName}-${prayerPwHash}`;
    const text = (commentTexts[key] || "").trim();
    if (!text) return;
    if (submitting) return;
    setSubmitting(true);
    const commenter = isAdmin ? "관리자" : currentUser.name;
    try {
      const ref = doc(db, "prayers", selectedMonth);
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        const current = snap.exists() ? snap.data().items || [] : [];
        const updated = current.map((p) => {
          if (p.name === prayerName && p.pwHash === prayerPwHash) {
            const comments = p.comments || [];
            return { ...p, comments: [...comments, { name: commenter, text, createdAt: new Date().toISOString() }] };
          }
          return p;
        });
        transaction.set(ref, { items: updated });
      });
      await loadAllData(true);
      setCommentTexts((prev) => ({ ...prev, [key]: "" }));
      showNotification("댓글이 등록되었습니다.");
    } catch (e) { console.error(e); showNotification("댓글 등록 중 오류가 발생했습니다.", "error"); }
    finally { setSubmitting(false); }
  }

  async function deleteComment(prayerName, prayerPwHash, commentIdx) {
    try {
      const ref = doc(db, "prayers", selectedMonth);
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        const current = snap.exists() ? snap.data().items || [] : [];
        const updated = current.map((p) => {
          if (p.name === prayerName && p.pwHash === prayerPwHash) {
            const comments = (p.comments || []).filter((_, i) => i !== commentIdx);
            return { ...p, comments };
          }
          return p;
        });
        transaction.set(ref, { items: updated });
      });
      await loadAllData(true);
      showNotification("댓글이 삭제되었습니다.");
    } catch (e) { console.error(e); }
  }

  function startEdit(prayer) {
    setPrayerText(prayer.text); setPrayerPublic(prayer.isPublic); setEditingPrayer(prayer);
  }

  function canSeePrayer(prayer) {
    if (prayer.isPublic) return true;
    if (isAdmin) return true;
    if (currentUser && prayer.name === currentUser.name && prayer.pwHash === currentUser.pwHash) return true;
    return false;
  }

  function isOwner(prayer) {
    return currentUser && prayer.name === currentUser.name && prayer.pwHash === currentUser.pwHash;
  }

  const monthPrayers = (prayers[selectedMonth] || []).filter(canSeePrayer);
  const myPrayer = currentUser
    ? (prayers[selectedMonth] || []).find((p) => p.name === currentUser.name && p.pwHash === currentUser.pwHash)
    : null;
  const hasAnyActiveMonth = MONTHS.some((m) => isMonthActive(m.key));
  const currentAnnouncement = announcements[selectedMonth] || "";

  // --- 렌더링 ---
  return (
    <div style={S.app}>
      <style>{globalCSS}</style>

      {notification && (
        <div style={{ ...S.notification,
          background: notification.type === "error" ? "#c0392b" : "rgba(255,255,255,0.12)",
          borderLeft: notification.type === "error" ? "3px solid #e74c3c" : "3px solid rgba(255,255,255,0.4)",
        }}>{notification.msg}</div>
      )}

      {deleteConfirm && (
        <div style={S.modalOverlay}>
          <div style={S.modalBox}>
            <p style={S.modalText}>
              {deleteConfirm.type === "user"
                ? `"${deleteConfirm.name}"님의 모든 기도제목을 삭제할까요?`
                : `"${deleteConfirm.name}"님의 이번 달 기도제목을 삭제할까요?`}
            </p>
            <div style={S.modalBtns}>
              <button type="button" style={S.modalConfirmBtn}
                onClick={() => {
                  if (deleteConfirm.type === "user") handleDeleteUser(deleteConfirm.name, deleteConfirm.pwHash);
                  else handleDeletePrayer(deleteConfirm.monthKey, deleteConfirm.name, deleteConfirm.pwHash);
                }}>삭제</button>
              <button type="button" style={S.modalCancelBtn} onClick={() => setDeleteConfirm(null)}>취소</button>
            </div>
          </div>
        </div>
      )}

      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logoArea} onClick={() => { setView(currentUser || isAdmin ? "months" : "home"); setEditingPrayer(null); setEditingAnnouncement(false); }}>
            <h1 style={S.logoText}>오운완</h1>
          </div>
          {(currentUser || isAdmin) && (
            <div style={S.headerRight}>
              <span style={S.userName}>{isAdmin ? "관리자" : currentUser?.name}</span>
              <button type="button" style={S.logoutBtn} onClick={handleLogout}>로그아웃</button>
            </div>
          )}
        </div>
      </header>

      <main style={S.main}>
        {/* ===== HOME ===== */}
        {view === "home" && (
          <div style={S.homeContainer}>
            <div style={S.heroSection}>
              <div style={S.heroBgWrap}>
                <svg viewBox="0 0 120 180" xmlns="http://www.w3.org/2000/svg" style={S.heroBgImg}>
                  <defs><linearGradient id="cg" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0.15)" />
                  </linearGradient></defs>
                  <rect x="52" y="10" width="16" height="160" rx="3" fill="url(#cg)" />
                  <rect x="20" y="45" width="80" height="16" rx="3" fill="url(#cg)" />
                </svg>
              </div>
              <p style={S.heroTitle}>오운완</p>
              <p style={S.heroSub}>함께 기도해요</p>
            </div>
            <div style={S.loginCardWrap}>
              <div style={S.loginCard}>
                <h2 style={S.cardTitle}>기도제목 나누기</h2>
                <p style={S.cardDesc}>이름과 비밀번호로 로그인하여 기도제목을 나눠주세요</p>
                <div style={S.formDiv}>
                  <input style={S.input} placeholder="이름" value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") doLogin(); }} />
                  <input style={S.input} type="password" placeholder="비밀번호" value={loginPw}
                    onChange={(e) => setLoginPw(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") doLogin(); }} />
                  <button type="button" style={S.primaryBtn} onClick={doLogin}>로그인</button>
                </div>
                <p style={S.loginHint}>
                  * 처음 오시는 분은 이름과 비밀번호를 설정하시면 됩니다.<br />
                  * 이후 같은 정보로 로그인하여 기도제목을 수정할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===== MONTHS ===== */}
        {view === "months" && (
          <div style={S.monthsContainer}>
            {!hasAnyActiveMonth && (
              <div style={S.noActiveNotice}>
                <p>2026년 4월부터 기도제목을 나눌 수 있습니다.</p>
              </div>
            )}
            <div style={S.monthTabs}>
              {MONTHS.map((m) => {
                const active = isMonthActive(m.key);
                const selected = selectedMonth === m.key;
                return (
                  <button key={m.key} type="button" disabled={!active}
                    onClick={() => { if (active) { setSelectedMonth(m.key); setEditingPrayer(null); setPrayerText(""); setPrayerPublic(true); setEditingAnnouncement(false); loadAllData(true); } }}
                    style={{ ...S.monthTab, ...(selected && active ? S.monthTabSelected : {}), ...(!active ? S.monthTabDisabled : {}) }}>
                    {m.label}
                  </button>
                );
              })}
            </div>

            {hasAnyActiveMonth && (
              <>
                <h2 style={S.monthTitle}>{MONTHS.find((m) => m.key === selectedMonth)?.fullLabel}</h2>

                {/* ===== 공통 기도제목 게시판 ===== */}
                <div style={S.announcementSection}>
                  <h3 style={S.sectionTitle}>📌 공통 기도제목</h3>
                  {isAdmin && !editingAnnouncement && (
                    <button type="button" style={S.editBtnSmall}
                      onClick={() => { setAnnouncementText(currentAnnouncement); setEditingAnnouncement(true); }}>
                      {currentAnnouncement ? "수정" : "작성"}
                    </button>
                  )}
                  {isAdmin && editingAnnouncement ? (
                    <div style={S.formDiv}>
                      <textarea style={S.textarea} placeholder="공통 기도제목을 작성해주세요..." value={announcementText}
                        onChange={(e) => setAnnouncementText(e.target.value)} rows={3} />
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button type="button" style={{ ...S.primaryBtn, opacity: submitting ? 0.5 : 1 }}
                          onClick={saveAnnouncement} disabled={submitting}>{submitting ? "저장 중..." : "저장"}</button>
                        <button type="button" style={S.cancelBtn}
                          onClick={() => setEditingAnnouncement(false)}>취소</button>
                      </div>
                    </div>
                  ) : currentAnnouncement ? (
                    <p style={S.announcementText}>{currentAnnouncement}</p>
                  ) : (
                    <p style={S.announcementEmpty}>아직 공통 기도제목이 없습니다.</p>
                  )}
                </div>

                {/* ===== 기도제목 작성 ===== */}
                {currentUser && !myPrayer && !editingPrayer && (
                  <div style={S.writeSection}>
                    <h3 style={S.sectionTitle}>기도제목 작성</h3>
                    <div style={S.formDiv}>
                      <textarea style={S.textarea} placeholder="기도제목을 작성해주세요..." value={prayerText}
                        onChange={(e) => setPrayerText(e.target.value)} rows={4} />
                      <div style={S.visibilityRow}>
                        <span style={S.visLabel}>공개 설정:</span>
                        <button type="button" onClick={() => setPrayerPublic(true)}
                          style={{ ...S.visBtn, ...(prayerPublic ? S.visBtnActive : {}) }}>🌐 공개</button>
                        <button type="button" onClick={() => setPrayerPublic(false)}
                          style={{ ...S.visBtn, ...(!prayerPublic ? S.visBtnPrivate : {}) }}>🔒 비공개</button>
                      </div>
                      <p style={S.visHint}>{prayerPublic ? "모든 사람이 기도제목을 볼 수 있습니다." : "관리자만 기도제목을 볼 수 있습니다."}</p>
                      <button type="button" style={{ ...S.primaryBtn, opacity: submitting ? 0.5 : 1 }}
                        onClick={doSubmitPrayer} disabled={submitting}>{submitting ? "저장 중..." : "기도제목 등록"}</button>
                    </div>
                  </div>
                )}

                {/* ===== 기도제목 수정 ===== */}
                {currentUser && editingPrayer && (
                  <div style={S.writeSection}>
                    <h3 style={S.sectionTitle}>기도제목 수정</h3>
                    <div style={S.formDiv}>
                      <textarea style={S.textarea} value={prayerText} onChange={(e) => setPrayerText(e.target.value)} rows={4} />
                      <div style={S.visibilityRow}>
                        <span style={S.visLabel}>공개 설정:</span>
                        <button type="button" onClick={() => setPrayerPublic(true)}
                          style={{ ...S.visBtn, ...(prayerPublic ? S.visBtnActive : {}) }}>🌐 공개</button>
                        <button type="button" onClick={() => setPrayerPublic(false)}
                          style={{ ...S.visBtn, ...(!prayerPublic ? S.visBtnPrivate : {}) }}>🔒 비공개</button>
                      </div>
                      <p style={S.visHint}>{prayerPublic ? "모든 사람이 기도제목을 볼 수 있습니다." : "관리자만 기도제목을 볼 수 있습니다."}</p>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button type="button" style={{ ...S.primaryBtn, opacity: submitting ? 0.5 : 1 }}
                          onClick={doSubmitPrayer} disabled={submitting}>{submitting ? "저장 중..." : "수정 완료"}</button>
                        <button type="button" style={S.cancelBtn}
                          onClick={() => { setEditingPrayer(null); setPrayerText(""); setPrayerPublic(true); }}>취소</button>
                      </div>
                    </div>
                  </div>
                )}

                {currentUser && myPrayer && !editingPrayer && (
                  <div style={S.myPrayerBanner}>
                    <p style={S.myPrayerLabel}>✓ 이번 달 기도제목이 등록되어 있습니다</p>
                    <button type="button" style={S.editBtnSmall} onClick={() => startEdit(myPrayer)}>수정하기</button>
                  </div>
                )}

                {/* ===== 기도제목 목록 ===== */}
                <div style={S.prayerList}>
                  <h3 style={S.sectionTitle}>기도제목 목록 <span style={S.countBadge}>{monthPrayers.length}</span></h3>
                  {loading ? (
                    <div style={S.emptyState}>불러오는 중...</div>
                  ) : monthPrayers.length === 0 ? (
                    <div style={S.emptyState}>아직 등록된 기도제목이 없습니다.</div>
                  ) : (
                    monthPrayers.map((prayer, idx) => {
                      const cKey = `${prayer.name}-${prayer.pwHash}`;
                      return (
                        <div key={idx} style={S.prayerCard}>
                          <div style={S.prayerHeader}>
                            <div style={S.prayerNameRow}>
                              <div style={S.avatar}>{prayer.name.charAt(0)}</div>
                              <span style={S.prayerName}>{prayer.name}</span>
                              <span style={{
                                ...S.visBadge,
                                background: prayer.isPublic ? "rgba(46,204,113,0.15)" : "rgba(231,76,60,0.15)",
                                color: prayer.isPublic ? "#2ecc71" : "#e74c3c",
                              }}>{prayer.isPublic ? "공개" : "비공개"}</span>
                            </div>
                            {(isOwner(prayer) || isAdmin) && (
                              <div style={S.prayerActions}>
                                {isOwner(prayer) && <button type="button" style={S.actionBtn} onClick={() => startEdit(prayer)}>수정</button>}
                                <button type="button" style={{ ...S.actionBtn, color: "#e74c3c" }}
                                  onClick={() => setDeleteConfirm({ type: "prayer", monthKey: selectedMonth, name: prayer.name, pwHash: prayer.pwHash })}>삭제</button>
                              </div>
                            )}
                          </div>
                          <p style={S.prayerText}>{prayer.text}</p>
                          <p style={S.prayerDate}>{new Date(prayer.updatedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</p>

                          {/* ===== 댓글 영역 ===== */}
                          <div style={S.commentSection}>
                            {(prayer.comments || []).length > 0 && (
                              <div style={S.commentList}>
                                {(prayer.comments || []).map((c, ci) => (
                                  <div key={ci} style={S.commentItem}>
                                    <div style={S.commentTop}>
                                      <span style={S.commentName}>{c.name}</span>
                                      <span style={S.commentDate}>{new Date(c.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</span>
                                      {isAdmin && (
                                        <button type="button" style={{ ...S.actionBtn, color: "#e74c3c", fontSize: "11px" }}
                                          onClick={() => deleteComment(prayer.name, prayer.pwHash, ci)}>삭제</button>
                                      )}
                                    </div>
                                    <p style={S.commentText}>{c.text}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {(currentUser || isAdmin) && (
                              <div style={S.commentInputRow}>
                                <input style={S.commentInput}
                                  placeholder="댓글을 입력하세요..."
                                  value={commentTexts[cKey] || ""}
                                  onChange={(e) => setCommentTexts((prev) => ({ ...prev, [cKey]: e.target.value }))}
                                  onKeyDown={(e) => { if (e.key === "Enter") addComment(prayer.name, prayer.pwHash); }} />
                                <button type="button" style={S.commentBtn}
                                  onClick={() => addComment(prayer.name, prayer.pwHash)} disabled={submitting}>등록</button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* ===== 나의 기록 ===== */}
                {currentUser && (
                  <div style={S.historySection}>
                    <h3 style={S.sectionTitle}>나의 기도제목 기록</h3>
                    <div style={S.historyGrid}>
                      {MONTHS.filter((m) => isMonthActive(m.key)).map((m) => {
                        const mp = (prayers[m.key] || []).find(
                          (p) => p.name === currentUser.name && p.pwHash === currentUser.pwHash
                        );
                        return (
                          <div key={m.key} style={{ ...S.historyCard, borderLeft: mp ? "3px solid rgba(255,255,255,0.4)" : "3px solid rgba(255,255,255,0.08)" }}>
                            <span style={S.historyMonth}>{m.fullLabel}</span>
                            {mp ? <p style={S.historyText}>{mp.text}</p> : <p style={S.historyEmpty}>미등록</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ===== 관리자 사용자 목록 ===== */}
                {isAdmin && (
                  <div style={S.historySection}>
                    <h3 style={S.sectionTitle}>👤 등록된 사용자 목록 (관리자 전용)</h3>
                    <div style={S.userListWrap}>
                      {(() => {
                        const userMap = {};
                        MONTHS.forEach((m) => {
                          (prayers[m.key] || []).forEach((p) => {
                            if (p.pw) userMap[p.name + "|" + p.pwHash] = { name: p.name, pw: p.pw, pwHash: p.pwHash };
                          });
                        });
                        const users = Object.values(userMap);
                        if (users.length === 0) return <p style={S.historyEmpty}>아직 등록된 사용자가 없습니다.</p>;
                        return users.map((u, i) => (
                          <div key={i} style={S.userRow}>
                            <div style={S.userRowInfo}>
                              <span style={S.userRowName}>{u.name}</span>
                              <span style={S.userRowPw}>{u.pw}</span>
                            </div>
                            <button type="button" style={{ ...S.actionBtn, color: "#e74c3c" }}
                              onClick={() => setDeleteConfirm({ type: "user", name: u.name, pwHash: u.pwHash })}>삭제</button>
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

      <footer style={S.footer}>
        <p style={S.footerText}>오운완 © 2026</p>
      </footer>
    </div>
  );
}

// --- 스타일 ---
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=Nanum+Pen+Script&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0f; }
  input, textarea, button { font-family: 'Noto Sans KR', sans-serif; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeInSlow { from { opacity: 0; } to { opacity: 1; } }
  button:hover { opacity: 0.85; }
  input:focus, textarea:focus { border-color: rgba(255,255,255,0.3) !important; outline: none; }
`;

const S = {
  app: { fontFamily: "'Noto Sans KR', sans-serif", background: "#0a0a0f", color: "#e8e6e3", minHeight: "100vh", display: "flex", flexDirection: "column" },
  notification: { position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", padding: "12px 28px", borderRadius: "6px", fontSize: "14px", zIndex: 1000, animation: "slideDown 0.3s ease", backdropFilter: "blur(10px)", color: "#fff", letterSpacing: "0.3px", maxWidth: "90vw", textAlign: "center" },
  header: { borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100, background: "rgba(10,10,15,0.9)" },
  headerInner: { maxWidth: "1100px", margin: "0 auto", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  logoArea: { display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" },
  logoText: { fontSize: "22px", fontWeight: 700, letterSpacing: "3px", color: "#fff" },
  headerRight: { display: "flex", alignItems: "center", gap: "16px" },
  userName: { fontSize: "14px", color: "rgba(255,255,255,0.6)", fontWeight: 300 },
  logoutBtn: { background: "none", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", padding: "6px 16px", borderRadius: "4px", cursor: "pointer", fontSize: "13px" },
  main: { flex: 1, maxWidth: "1100px", margin: "0 auto", width: "100%", padding: "0 24px" },
  homeContainer: { animation: "fadeIn 0.6s ease" },
  heroSection: { textAlign: "center", padding: "60px 20px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" },
  heroBgWrap: { width: "80px", height: "120px", animation: "fadeInSlow 2s ease" },
  heroBgImg: { width: "100%", height: "100%" },
  heroTitle: { fontFamily: "'Nanum Pen Script', cursive", fontSize: "clamp(36px, 8vw, 56px)", fontWeight: 400, color: "#fff", letterSpacing: "4px", lineHeight: 1.2 },
  heroSub: { fontFamily: "'Nanum Pen Script', cursive", fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 400, color: "rgba(255,255,255,0.55)", letterSpacing: "2px", marginTop: "-8px" },
  loginCardWrap: { maxWidth: "420px", margin: "0 auto 80px" },
  loginCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "32px", animation: "fadeIn 0.6s ease" },
  cardTitle: { fontSize: "16px", fontWeight: 500, marginBottom: "8px", letterSpacing: "1px" },
  cardDesc: { fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "24px", lineHeight: 1.6, fontWeight: 300 },
  formDiv: { display: "flex", flexDirection: "column", gap: "12px" },
  input: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", padding: "12px 16px", color: "#e8e6e3", fontSize: "14px", outline: "none", width: "100%" },
  textarea: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", padding: "14px 16px", color: "#e8e6e3", fontSize: "14px", outline: "none", resize: "vertical", lineHeight: 1.7, minHeight: "100px", width: "100%" },
  primaryBtn: { background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "12px 24px", borderRadius: "4px", cursor: "pointer", fontSize: "14px", fontWeight: 500, letterSpacing: "1px", marginTop: "4px" },
  cancelBtn: { background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", padding: "12px 24px", borderRadius: "4px", cursor: "pointer", fontSize: "14px" },
  loginHint: { fontSize: "12px", color: "rgba(255,255,255,0.3)", lineHeight: 1.8, marginTop: "12px", fontWeight: 300 },
  monthsContainer: { padding: "40px 0 80px", animation: "fadeIn 0.5s ease" },
  noActiveNotice: { textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.5)", fontSize: "16px", fontWeight: 300 },
  monthTabs: { display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "32px", justifyContent: "center" },
  monthTab: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", padding: "10px 20px", borderRadius: "4px", cursor: "pointer", fontSize: "14px", fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: "0.5px" },
  monthTabSelected: { background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.3)", color: "#fff", fontWeight: 500 },
  monthTabDisabled: { opacity: 0.25, cursor: "not-allowed", background: "transparent" },
  monthTitle: { textAlign: "center", fontSize: "24px", fontWeight: 300, letterSpacing: "3px", marginBottom: "40px", color: "rgba(255,255,255,0.8)" },

  // 공통 기도제목
  announcementSection: { background: "rgba(255,220,100,0.04)", border: "1px solid rgba(255,220,100,0.12)", borderRadius: "8px", padding: "24px 28px", marginBottom: "32px", position: "relative" },
  announcementText: { fontSize: "14px", lineHeight: 1.8, color: "rgba(255,255,255,0.75)", fontWeight: 300, whiteSpace: "pre-wrap", wordBreak: "break-word" },
  announcementEmpty: { fontSize: "13px", color: "rgba(255,255,255,0.2)", fontWeight: 300, fontStyle: "italic" },

  writeSection: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "28px", marginBottom: "32px" },
  sectionTitle: { fontSize: "15px", fontWeight: 500, letterSpacing: "1px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px", color: "rgba(255,255,255,0.8)" },
  visibilityRow: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" },
  visLabel: { fontSize: "13px", color: "rgba(255,255,255,0.5)", fontWeight: 300 },
  visBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", padding: "8px 16px", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontFamily: "'Noto Sans KR', sans-serif" },
  visBtnActive: { background: "rgba(46,204,113,0.12)", borderColor: "rgba(46,204,113,0.3)", color: "#2ecc71" },
  visBtnPrivate: { background: "rgba(231,76,60,0.1)", borderColor: "rgba(231,76,60,0.25)", color: "#e74c3c" },
  visHint: { fontSize: "12px", color: "rgba(255,255,255,0.3)", fontWeight: 300 },
  myPrayerBanner: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "6px", padding: "16px 24px", marginBottom: "32px", flexWrap: "wrap", gap: "12px" },
  myPrayerLabel: { fontSize: "14px", color: "rgba(255,255,255,0.6)", fontWeight: 300 },
  editBtnSmall: { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", padding: "6px 16px", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontFamily: "'Noto Sans KR', sans-serif" },
  prayerList: { marginBottom: "48px" },
  countBadge: { fontSize: "12px", background: "rgba(255,255,255,0.08)", padding: "2px 10px", borderRadius: "12px", fontWeight: 400, color: "rgba(255,255,255,0.5)" },
  emptyState: { textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.25)", fontSize: "14px", fontWeight: 300, letterSpacing: "0.5px" },
  prayerCard: { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", padding: "24px", marginBottom: "12px", animation: "fadeIn 0.4s ease" },
  prayerHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", flexWrap: "wrap", gap: "10px" },
  prayerNameRow: { display: "flex", alignItems: "center", gap: "10px" },
  avatar: { width: "32px", height: "32px", borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.6)", flexShrink: 0 },
  prayerName: { fontSize: "15px", fontWeight: 500 },
  visBadge: { fontSize: "11px", padding: "2px 8px", borderRadius: "3px", fontWeight: 400 },
  prayerActions: { display: "flex", gap: "8px" },
  actionBtn: { background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "12px", padding: "4px 8px", fontFamily: "'Noto Sans KR', sans-serif" },
  prayerText: { fontSize: "14px", lineHeight: 1.8, color: "rgba(255,255,255,0.7)", fontWeight: 300, whiteSpace: "pre-wrap", wordBreak: "break-word" },
  prayerDate: { fontSize: "12px", color: "rgba(255,255,255,0.2)", marginTop: "14px", fontWeight: 300 },

  // 댓글
  commentSection: { marginTop: "16px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px" },
  commentList: { marginBottom: "10px" },
  commentItem: { padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" },
  commentTop: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" },
  commentName: { fontSize: "12px", fontWeight: 500, color: "rgba(255,255,255,0.6)" },
  commentDate: { fontSize: "11px", color: "rgba(255,255,255,0.2)", fontWeight: 300 },
  commentText: { fontSize: "13px", lineHeight: 1.6, color: "rgba(255,255,255,0.55)", fontWeight: 300 },
  commentInputRow: { display: "flex", gap: "8px", alignItems: "center" },
  commentInput: { flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px", padding: "8px 12px", color: "#e8e6e3", fontSize: "13px", outline: "none" },
  commentBtn: { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", padding: "8px 16px", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontFamily: "'Noto Sans KR', sans-serif", flexShrink: 0 },

  historySection: { borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "40px", marginBottom: "40px" },
  historyGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" },
  historyCard: { background: "rgba(255,255,255,0.02)", padding: "16px 20px", borderRadius: "4px" },
  historyMonth: { fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.5)", letterSpacing: "0.5px", display: "block", marginBottom: "8px" },
  historyText: { fontSize: "13px", lineHeight: 1.7, color: "rgba(255,255,255,0.6)", fontWeight: 300, whiteSpace: "pre-wrap", wordBreak: "break-word" },
  historyEmpty: { fontSize: "13px", color: "rgba(255,255,255,0.15)", fontWeight: 300, fontStyle: "italic" },
  userListWrap: { display: "flex", flexDirection: "column", gap: "8px" },
  userRow: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "4px", padding: "12px 16px", gap: "12px" },
  userRowInfo: { display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", flex: 1 },
  userRowName: { fontSize: "14px", fontWeight: 500, color: "rgba(255,255,255,0.8)" },
  userRowPw: { fontSize: "13px", fontWeight: 300, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", letterSpacing: "1px" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, backdropFilter: "blur(4px)" },
  modalBox: { background: "#151520", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "32px", maxWidth: "360px", width: "90%", textAlign: "center" },
  modalText: { fontSize: "15px", color: "rgba(255,255,255,0.85)", lineHeight: 1.7, marginBottom: "24px", fontWeight: 400 },
  modalBtns: { display: "flex", gap: "12px", justifyContent: "center" },
  modalConfirmBtn: { background: "rgba(231,76,60,0.15)", border: "1px solid rgba(231,76,60,0.4)", color: "#e74c3c", padding: "10px 24px", borderRadius: "4px", cursor: "pointer", fontSize: "14px", fontWeight: 500, fontFamily: "'Noto Sans KR', sans-serif" },
  modalCancelBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", padding: "10px 24px", borderRadius: "4px", cursor: "pointer", fontSize: "14px", fontFamily: "'Noto Sans KR', sans-serif" },
  footer: { borderTop: "1px solid rgba(255,255,255,0.04)", padding: "24px", textAlign: "center", marginTop: "auto" },
  footerText: { fontSize: "12px", color: "rgba(255,255,255,0.2)", letterSpacing: "2px", fontWeight: 300 },
};
