'use client';

export default function PrintButton() {
  const handlePrint = () => {
    const el = document.getElementById('request-detail-page');
    if (!el) return;

    const win = window.open('', '_blank', 'width=1000,height=800');
    if (!win) return;

    const styles = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
        } catch {
          return sheet.href ? `@import url("${sheet.href}");` : '';
        }
      })
      .join('\n');

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>Request Details</title>
          <style>${styles}</style>
        </head>
        <body>
          ${el.outerHTML}
        </body>
      </html>
    `);

    win.document.close();
    win.focus();
    win.onload = () => { win.print(); win.close(); };
  };

  return (
    <button onClick={handlePrint} type="button" className="inline-flex items-center rounded-md border border-[#91c0fa] bg-[var(--info-bg)] px-3 py-1.5 text-sm font-medium text-[var(--info-text)] shadow-sm hover:brightness-95 print:hidden">
      Print
    </button>
  );
}