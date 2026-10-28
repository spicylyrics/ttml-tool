---
type: fix
impact: 2
highlight: false
---
ASS export opens in ytsubconverter

Exported `.ass` files now have a proper header and standard event columns, so strict tools like ytsubconverter read them. Each line shows only while it's sung, filling white over gray in Roboto, with background vocals smaller and italic at the top. Timestamps past one hour no longer show minutes above 59.
