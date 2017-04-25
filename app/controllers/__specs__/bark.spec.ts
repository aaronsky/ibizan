import * as http from 'http';

import 'mocha';
import { expect } from 'chai';

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

/*
describe('bark', () => {
  beforeEach(() => {
    this.room = Helper.createRoom();
  });
  afterEach(() => {
    this.room.destroy();
  });
  describe('user says: bark', () => {
    beforeEach(() => {
      this.room.say('briancoia', 'bark');
    });
    it('should reply bark(s) to user', () => {
      expect(this.room.messages[0]).to.equal(['briancoia', 'bark']);
      expect(this.room.messages[1][1]).to.include('bark');
    });
  });
  describe('user says: ibizan tell me a story', () => {
    beforeEach(() => {
      this.room.say('briancoia', 'ibizan tell me a story');
    });
    it('should tell a story to user', () => {
      expect(this.room.messages[0]).to.equal(['briancoia', 'ibizan tell me a story']);
      expect(this.room.messages[1][1]).to.include('w');
    });
  });
  describe('user says: good (dog|boy|pup|puppy|ibizan|ibi)', () => {
    beforeEach(() => {
      this.room.say('briancoia', 'good boy');
    });
    it('should display the ultimate seal of gratitude', () => {
      expect(this.room.messages).to.equal(['briancoia', 'good boy']);
      expect(this.room.messages[1][1]).to.include(':ok_hand:');
    });
  });
  describe('user says: ibizan fetch', () => {
    beforeEach(() => {
      this.room.say('briancoia', 'ibizan fetch');
    });
    it('should get impatient', () => {
      expect(this.room.messages).to.equal(['briancoia', 'ibizan fetch']);
      expect(this.room.messages[1][1]).to.include('impatient');
    });
  });
  describe('user says: ibizan fetch thing', () => {
    beforeEach(() => {
      this.room.say('briancoia', 'ibizan fetch thing');
    });
    it('should fetch thing', () => {
      expect(this.room.messages).to.equal(['briancoia', 'ibizan fetch thing']);
      expect(this.room.messages[1][1]).to.include('runs to fetch');
    });
  });
  describe('GET /', () => {
    beforeEach((done) => {
      http.get('http://localhost:8080/', (response) => {
        this.response = response;
        done();
      }).on('error', done());
    });
    it('response with status 200', () => {
      expect(this.response).to.exist;
      expect(this.response.statusCode).to.equal(200);
    });
  });
});
*/