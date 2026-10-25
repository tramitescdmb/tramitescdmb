export function EstiloImpresionFormato() {
  return (
    <style>{`@media print {
  @page { size: letter; margin: 12mm 14mm }
  body { background: #fff }
  .encabezado-modulo { display: none !important }
  .documento-formato { max-width: none }
}`}</style>
  );
}
