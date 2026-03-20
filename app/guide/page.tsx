import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "사용 안내",
  description: "PJBC 식사 신청 시스템 사용 안내",
};

export default function GuidePage() {
  return (
    <main className="guidePage">
      <style>{`
        .guidePage {
          min-height: 100vh;
          padding: 40px 16px 80px;
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: center;
          background:
            radial-gradient(circle at top left, #e0f2fe 0, #e5edff 40%, transparent 70%),
            radial-gradient(circle at bottom right, #fef3c7 0, #f9fafb 55%, #eef2ff 100%);
        }

        .guidePage::before {
          content: "";
          position: fixed;
          inset: 0;
          background-image: url("/pjbc-silverware.png");
          background-repeat: no-repeat;
          background-position: 50% 8%;
          background-size: 520px auto;
          opacity: 0.06;
          filter: grayscale(100%) contrast(110%);
          pointer-events: none;
          z-index: -1;
        }

        .container {
          width: 100%;
          max-width: 860px;
        }
        .topbar {
          display: grid;
          grid-template-columns: 86px 1fr 86px;
          align-items: center;
          gap: 14px;
          margin-bottom: 20px;
        }

        .logoWrap {
          width: 86px;
          height: 86px;
          border-radius: 26px;
          background: rgba(255, 255, 255, 0.9);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 18px 60px rgba(15, 23, 42, 0.06);
          overflow: visible;
          flex: 0 0 auto;
          border: 1px solid rgba(226, 232, 240, 0.9);
        }

        .logoImg {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: grayscale(100%) contrast(115%);
          opacity: 0.85;
          transform: scale(0.92);
        }

        .titleBlock {
          text-align: center;
        }

        .title {
          font-size: 38px;
          font-weight: 950;
          letter-spacing: -0.04em;
          margin: 0;
          color: #0f172a;
          line-height: 1.1;
        }

        .subtitle {
          margin: 6px 0 0;
          color: #64748b;
          font-weight: 800;
          font-size: 16px;
        }

        .card {
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(226, 232, 240, 0.85);
          border-radius: 18px;
          box-shadow: 0 24px 80px rgba(15, 23, 42, 0.06);
          backdrop-filter: blur(18px);
          padding: 18px;
        }

        .sectionTitle {
          margin: 16px 0 10px;
          font-size: 18px;
          font-weight: 950;
          letter-spacing: -0.01em;
          color: transparent;
          background: linear-gradient(135deg, #2563eb 0%, #7c3aed 55%, #06b6d4 100%);
          -webkit-background-clip: text;
          background-clip: text;
          padding-left: 10px;
          border-left: 4px solid rgba(37, 99, 235, 0.55);
        }
        .muted {
          color: #64748b;
        }
        .steps {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 700px) {
          .steps {
            grid-template-columns: 1fr 1fr 1fr;
          }
        }
        .step {
          padding: 14px;
          border-radius: 16px;
          border: 1px solid rgba(226, 232, 240, 0.9);
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
        }
        .stepTop {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 8px;
        }
        .stepNum {
          width: 34px;
          height: 34px;
          border-radius: 999px; /* 동그라미 아이콘 */
          background: #2563eb;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          letter-spacing: -0.02em;
          flex: 0 0 auto;
        }
        .stepTitle {
          font-weight: 900;
          color: #1d4ed8;
          font-size: 16px;
          margin: 0;
        }
        .stepDesc {
          margin: 0;
          color: #334155;
          line-height: 1.6;
          font-size: 14.5px;
          font-weight: 650;
        }
        .list {
          display: grid;
          gap: 10px;
          margin-top: 6px;
        }
        .item {
          padding: 12px 12px;
          border-radius: 14px;
          border: 1px solid rgba(226, 232, 240, 0.9);
          background: #ffffff;
        }
        .itemTitle {
          font-size: 14px;
          font-weight: 950;
          color: transparent;
          background: linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%);
          -webkit-background-clip: text;
          background-clip: text;
          margin-bottom: 0;
        }

        .itemTitleRow {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 6px;
        }

        .itemIcon {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 950;
          color: #1d4ed8;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          flex: 0 0 auto;
        }

        .itemIconAmber {
          color: #92400e;
          background: #fffbeb;
          border-color: #fde68a;
        }

        .itemIconEmerald {
          color: #065f46;
          background: #ecfdf5;
          border-color: #a7f3d0;
        }

        .itemIconSlate {
          color: #334155;
          background: #f8fafc;
          border-color: #e2e8f0;
        }
        .itemText {
          font-size: 14.5px;
          color: #334155;
          line-height: 1.6;
          font-weight: 650;
        }

        .badgeRow {
          margin-top: 10px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          font-weight: 950;
          font-size: 12px;
          border: 1px solid transparent;
        }

        .badgeDevelop {
          background: #ecfeff;
          border-color: #a5f3fc;
          color: #155e75;
        }

        .badgePlan {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1d4ed8;
        }

        .footerRow {
          margin-top: 18px;
          display: flex;
          justify-content: center;
        }
        .backBtn {
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid rgba(226, 232, 240, 0.9);
          background: #ffffff;
          font-weight: 950;
          color: #1d4ed8;
          font-size: 14.5px;
        }

        .topbarSpacer {
          width: 86px;
          height: 1px;
        }
      `}</style>

      <div className="container">
        <div className="topbar">
          <Link className="logoWrap" href="/">
            <Image
              className="logoImg"
              src="/pjbc-silverware.png"
              alt="PJBC"
              width={86}
              height={86}
              unoptimized
            />
          </Link>
          <div className="titleBlock">
            <h1 className="title">사용 안내</h1>
            <p className="subtitle">PJBC 식사 신청 시스템 사용 방법</p>
          </div>
            <div className="topbarSpacer" />
        </div>

        <div className="card">
          <div className="sectionTitle">사용 방법</div>

          <div className="steps">
            <div className="step">
              <div className="stepTop">
                <div className="stepNum">1</div>
                <h3 className="stepTitle">메뉴 선택</h3>
              </div>
              <p className="stepDesc">
                원하는 요일의 메뉴 카드를 클릭하여 신청을 시작하세요.
              </p>
            </div>

            <div className="step">
              <div className="stepTop">
                <div className="stepNum">2</div>
                <h3 className="stepTitle">정보 입력</h3>
              </div>
              <p className="stepDesc">
                목장 번호(숫자만), 이름, 전화번호와 식사 인원수를 입력하세요.
              </p>
            </div>

            <div className="step">
              <div className="stepTop">
                <div className="stepNum">✓</div>
                <h3 className="stepTitle">신청 완료</h3>
              </div>
              <p className="stepDesc">
                신청하기 버튼을 클릭하면 신청이 완료됩니다.
              </p>
            </div>
          </div>

          <div className="sectionTitle">상세 안내</div>
          <div className="list">
            <div className="item">
              <div className="itemTitleRow">
                <div className="itemIcon itemIconEmerald">✓</div>
                <div className="itemTitle">신청 내역 확인 및 수정</div>
              </div>
              <div className="itemText">
                상단의 <b>&quot;내 신청내역&quot;</b> 메뉴를 통해 신청한 내용을 확인할 수
                있습니다. 이름과 전화번호로 검색하여 신청 내역을 조회하고,
                필요시 수정하거나 취소할 수 있습니다.
              </div>
            </div>

            <div className="item">
              <div className="itemTitleRow">
                <div className="itemIcon itemIconAmber">⏰</div>
                <div className="itemTitle">수정/취소 가능 시간</div>
              </div>
              <div className="itemText">
                신청한 식사는 해당 날짜 오후 6시 30분까지만 수정하거나 취소할 수
                있습니다. 예를 들어, 20일 식사는 20일 오후 6시 30분까지 수정
                가능합니다.
              </div>
            </div>

            <div className="item">
              <div className="itemTitleRow">
                <div className="itemIcon itemIconSlate">🍽</div>
                <div className="itemTitle">식사 인원수 입력</div>
              </div>
              <div className="itemText">
                어른, 자녀, 미취학 아동 식사 수를 각각 드롭다운에서 선택해주세요.
                0명부터 20명까지 선택할 수 있습니다.
                <br />
                <span className="muted" style={{ fontWeight: 850 }}>
                  미취학 아동
                </span>
                은 초등학교 입학 전 아동을 의미합니다.
              </div>
            </div>

            <div className="item">
              <div className="itemTitleRow">
                <div className="itemIcon">★</div>
                <div className="itemTitle">필수 입력 정보</div>
              </div>
              <div className="itemText">
                목장 번호(숫자만), 이름, 전화번호는 필수 입력 항목입니다. 최소 1명
                이상의 식사 인원수(어른 또는 자녀)를 입력해야 신청이 가능합니다.
              </div>
            </div>

            <div className="item">
              <div className="itemTitleRow">
                <div className="itemIcon itemIconEmerald">🛡</div>
                <div className="itemTitle">중복 신청 방지</div>
              </div>
              <div className="itemText">
                동일한 식사에 대해 중복 신청은 불가능합니다. 이미 신청한 경우
                <b> &quot;내 신청내역&quot;</b>에서 기존 신청을 수정하거나 취소할 수
                있습니다.
              </div>
            </div>
          </div>

          <div className="sectionTitle">업데이트 예정 기능</div>
          <div className="list">
            <div className="item">
              <div className="itemTitleRow">
                <div className="itemIcon itemIconAmber">⛳</div>
                <div className="itemTitle">일괄 신청 기능</div>
              </div>
              <div className="itemText">
                요일별로 각각 신청하는 것이 아닌, 한 번에 여러 날의 식사를 일괄 신청할
                수 있는 기능을 준비 중입니다.
              </div>
              <div className="badgeRow">
                <span className="badge badgeDevelop">개발 예정</span>
              </div>
            </div>

            <div className="item">
              <div className="itemTitleRow">
                <div className="itemIcon">✦</div>
                <div className="itemTitle">더 많은 편의 기능</div>
              </div>
              <div className="itemText">
                사용자 피드백을 바탕으로 더욱 편리한 기능들을 지속적으로 추가할
                예정입니다.
              </div>
              <div className="badgeRow">
                <span className="badge badgePlan">계획 중</span>
              </div>
            </div>
          </div>

          <div className="footerRow">
            <Link className="backBtn" href="/">
              메인 페이지로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

