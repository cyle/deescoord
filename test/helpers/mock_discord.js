/* eslint-disable no-undef */
export class MockDiscordClient {
  constructor() {
    this.on = sandbox.spy();
    this.sendMessage = sandbox.spy();
  }
}
