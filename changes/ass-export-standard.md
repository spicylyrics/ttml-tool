---
type: fix
impact: 2
highlight: false
---
ASS export opens in ytsubconverter

Exported `.ass` files now have a proper header, a `Default` style and standard event columns, so strict tools like ytsubconverter read them, and timestamps past one hour no longer show minutes above 59.
