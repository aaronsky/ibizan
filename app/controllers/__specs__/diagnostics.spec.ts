
import * as http from 'http';
import * as querystring from 'querystring';
import 'mocha';
const { expect } = require('chai');

class Room {
  readonly name: string = 'ibizan';
  messages: string[][] = [];
  say(userName, message) {
    this.messages.push([userName, message]);
    this.messages.push([userName, message]);
  }
  destroy() {
    this.messages = [];
  }
}
class Helper {
  static createRoom() {
    return new Room();
  }
}

// const goodtoken = querystring.stringify({ token: 'abc123' })
// const badtoken = querystring.stringify({ token: 'f' })

// describe('diagnostics', () => {
//   beforeEach(() => {
//     this.room = helper.createRoom();
//   });
//   afterEach(() => {
//     this.room.destroy();
//   });
//   describe('user says: ibizan uptime', () => {
//     beforeEach(() => {
//       this.room.user.say('aaronsky', 'ibizan uptime');
//     });
//     it('should reply with uptime', () => {
//       expect(this.room.messages[0]).to.equal(['aaronsky', 'ibizan uptime']);
//       expect(this.room.messages[1][1]).to.include('has been up');
//     });
//   });
//   // describe('user says: ibizan users', () => {
//   //   beforeEach(() => {
//   //     this.room.user.say('aaronsky', 'ibizan users');
//   //   });
//   //   it('should reply with uptime', () => {
//   //     expect(this.room.messages[0]).to.equal(['aaronsky', 'ibizan users']);
//   //     expect(this.room.messages[1][1]).to.include('must be an admin');
//   //   });
//   // });
//   // describe('admin says: ibizan users', () => {
//   //   beforeEach(() => {
//   //     this.room.user.say('admin', 'ibizan users');
//   //   });
//   //   it('should reply with uptime', () => {
//   //     expect(this.room.messages[0]).to.equal(['admin', 'ibizan users']);
//   //     expect(this.room.messages[1][1]).to.include('users');
//   //   });
//   // });
// });