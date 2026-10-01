export const CSS = `
*{box-sizing:border-box;margin:0}
[hidden]{display:none!important}
html{scroll-behavior:smooth}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#172033;background:#f5f7fa;line-height:1.5}
a{color:#265f9b;text-decoration:none}a:hover{text-decoration:underline}
.skip-link{position:absolute;left:14px;top:-60px;background:#fff;color:#16294a;padding:10px 14px;border-radius:7px;font-weight:700;z-index:10}.skip-link:focus{top:12px}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,[tabindex]:focus-visible{outline:3px solid #f0b429;outline-offset:3px}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px}
header{background:#1f3864;color:#fff;padding:34px 0 26px}
header .header-row{display:flex;align-items:center;justify-content:space-between;gap:22px;flex-wrap:wrap}
header .brand{font-size:15px;letter-spacing:2px;font-weight:750;color:#c6ddfa;text-transform:uppercase}header .brand:hover{text-decoration:none;color:#fff}
header nav{display:flex;gap:18px;flex-wrap:wrap;font-size:13.5px}header nav a{color:#e0ecfa;font-weight:650}header nav a:hover{color:#fff}
header h1{font-size:32px;margin:9px 0 10px;line-height:1.18;max-width:760px}
header p{color:#d3def0;max-width:680px;font-size:15px;line-height:1.55}
.bar{background:#16294a;padding:10px 0;font-size:13px;color:#b6c7e2}.bar b{color:#fff}
.cta{background:#eaf1f9;border:1px solid #c9dbf0;border-radius:10px;padding:18px 20px;margin:26px 0;display:flex;gap:14px;flex-wrap:wrap;align-items:center;justify-content:space-between}
.cta .t b{font-size:16px}.cta .t div{font-size:13px;color:#51637f;margin-top:3px}
.cta form{display:flex;gap:8px;flex-wrap:wrap}.cta .trap{position:absolute;left:-10000px}
.cta input[type=email]{padding:10px 12px;border:1px solid #a9bbd2;border-radius:7px;min-width:240px;font-size:14px}
.cta button{background:#2e75b6;color:#fff;border:0;border-radius:7px;padding:10px 18px;font-weight:700;font-size:14px;cursor:pointer}.cta button:hover{background:#245f99}
.board{margin:28px 0}.board-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:10px}.board-head h2{font-size:22px}.board-head p{font-size:13.5px;color:#586981;margin-top:3px}.count{color:#51637f;font-size:13px;font-weight:700;white-space:nowrap}
.search-panel{background:#fff;border:1px solid #d7e2ef;border-radius:10px;padding:16px;box-shadow:0 1px 3px rgba(16,32,64,.06)}
.filter-grid{display:grid;grid-template-columns:minmax(250px,2fr) minmax(125px,1fr) minmax(140px,1fr) auto auto auto;gap:10px;align-items:end}.filter-grid>*{min-width:0}
.filter{display:grid;gap:5px;font-size:12.5px;color:#41516a;font-weight:700}.filter input,.filter select{width:100%;min-width:0;padding:10px 11px;border:1px solid #aebfd4;border-radius:7px;font:inherit;font-size:14px;color:#1a2233;background:#fff;min-height:42px}.filter input::placeholder{color:#718096}
.check-filter{display:flex;align-items:center;gap:8px;min-height:42px;padding:9px 10px;border:1px solid #c4d1e0;border-radius:7px;background:#f8fafc;font-size:13px;font-weight:700;color:#41516a;white-space:nowrap}.check-filter input{width:17px;height:17px}
.search-button,.clear-button{display:inline-flex;align-items:center;justify-content:center;min-height:42px;border-radius:7px;padding:10px 15px;font-size:14px;font-weight:700;cursor:pointer}.search-button{border:0;background:#2e75b6;color:#fff}.search-button:hover{background:#245f99}.clear-button{border:1px solid #aebfd4;background:#fff;color:#33445d}.clear-button:hover{background:#f1f5f9;text-decoration:none}
.search-help{font-size:12.5px;color:#607088;margin-top:9px}
.board-offer{background:#eaf1f9;border:1px solid #b8d2ee;border-left:5px solid #2e75b6;border-radius:9px;padding:14px 16px;margin:14px 0;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}.board-offer b{font-size:15px}.board-offer p{font-size:13px;color:#50627c;margin-top:3px}.board-offer a{display:inline-block;background:#1f3864;color:#fff;padding:9px 13px;border-radius:7px;font-size:13px;font-weight:700}.board-offer a:hover{background:#16294a;text-decoration:none}
.table-wrap{overflow-x:auto;border-radius:10px;box-shadow:0 1px 3px rgba(16,32,64,.08)}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden}
caption{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
th{background:#1f3864;color:#fff;text-align:left;font-size:12.5px;letter-spacing:.35px;padding:11px 14px;text-transform:uppercase}
td{padding:12px 14px;border-top:1px solid #edf1f7;font-size:14px;vertical-align:top}tr:hover td{background:#f6faff}
.badge{display:inline-block;background:#eaf3ea;color:#2f6b2f;border-radius:5px;font-size:11.5px;padding:2px 7px;margin-top:4px}.soon{color:#a92e2e;font-weight:700}.ok-days{color:#51637f}.meta{font-size:12.5px;color:#607088;margin-top:3px}
.empty{background:#fff;border-radius:10px;padding:46px 20px;text-align:center;color:#51637f;box-shadow:0 1px 3px rgba(16,32,64,.08)}.empty p{margin:6px auto 14px;max-width:560px}.empty a{font-weight:700}
.tools{margin:24px 0}.tools h2{font-size:20px;margin-bottom:5px}.tools>p{color:#51637f;font-size:13.5px;margin-bottom:12px}.product-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.product{background:#fff;border:1px solid #dce5f0;border-radius:10px;padding:16px;box-shadow:0 1px 3px rgba(16,32,64,.05)}.product h3{font-size:15px;line-height:1.3}.product p{font-size:13px;color:#596a82;line-height:1.45;margin:7px 0 12px}.product a{display:inline-block;background:#1f3864;color:#fff;border-radius:6px;padding:8px 11px;font-size:12.5px;font-weight:700}.product a:hover{background:#16294a;text-decoration:none}.product.featured{grid-column:1/-1;background:#eaf1f9;border:2px solid #2e75b6;padding:20px}.product.featured h3{font-size:18px}.product.featured p{font-size:14px;max-width:760px}.product.featured a{background:#2e75b6;font-size:13.5px;padding:10px 15px}
.state-intro{background:#fff;border-left:4px solid #2e75b6;border-radius:8px;padding:15px 18px;margin:20px 0 14px;color:#41516a}.state-intro h2{font-size:18px;color:#1a2233;margin-bottom:5px}.state-intro p{font-size:13.5px;line-height:1.55}.state-links{font-size:13px;color:#596a82;margin:12px 0 18px}.state-links a{margin-right:10px;white-space:nowrap}
.how{margin:30px 0}.how h2{font-size:20px;margin-bottom:12px}.how-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.how-card{background:#fff;border:1px solid #dce5f0;border-radius:9px;padding:16px}.how-card b{display:block;margin-bottom:5px}.how-card p{font-size:13px;color:#52647c}
.page-card{background:#fff;border:1px solid #dce5f0;border-radius:10px;padding:24px;margin:26px 0;color:#33445d}.page-card h2{color:#1a2233;font-size:19px;margin:22px 0 7px}.page-card h2:first-child{margin-top:0}.page-card p,.page-card li{font-size:14px;line-height:1.7}.page-card ul{padding-left:20px;margin-top:8px}
footer{margin:40px 0 30px;font-size:13px;color:#607088;line-height:1.7}.note{background:#fff8e6;border:1px solid #eadfb2;color:#6b5d21;font-size:13px;border-radius:8px;padding:10px 14px;margin:14px 0}.note.error{background:#fff0f0;border-color:#edc7c7;color:#8a2d2d}
@media(max-width:900px){.filter-grid{grid-template-columns:1fr 1fr}.search-button,.clear-button{width:100%}}
@media(max-width:720px){th:nth-child(3),td:nth-child(3){display:none}header h1{font-size:25px}.product-grid,.how-grid{grid-template-columns:1fr}.product.featured{grid-column:auto}.board-head{align-items:start;flex-direction:column}.filter-grid{grid-template-columns:1fr}.cta input[type=email]{min-width:0;width:100%}.cta form{width:100%}.cta button{flex:1}.table-wrap{border-radius:8px}}
`;
