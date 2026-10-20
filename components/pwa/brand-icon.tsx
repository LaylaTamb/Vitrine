/**
 * O desenho do ícone do app: o ponto roxo da marca e um "V", em traço — sem
 * fonte nenhuma (o `ImageResponse` desenha SVG direto). Cabe no círculo
 * central de 80%, então serve também como ícone "maskable" do Android.
 */
export function BrandIcon({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#131315",
      }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 100 100">
        <circle cx="16" cy="60" r="9" fill="#b98cc2" />
        <path
          d="M36 26 L60 76 L84 26"
          fill="none"
          stroke="#ececef"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
