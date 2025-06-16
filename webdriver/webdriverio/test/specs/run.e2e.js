describe('Hello Tauri', () => {
  it('should be cordial', async () => {
    const header = await $('body h1')
    const text = await header.getText()
    expect(text).toMatch(/^Welcome/)
  })

  it('should be excited', async () => {
    const header = await $('body h1')
    const text = await header.getText()
    expect(text).toMatch(/!$/)
  })

  it('should be easy on the eyes', async () => {
    const body = await $('body')
    const backgroundColor = await body.getCSSProperty('background-color')
    expect(luma(backgroundColor.parsed.hex)).toBeLessThan(100)
  })
})
