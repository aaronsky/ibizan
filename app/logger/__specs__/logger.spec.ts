
import 'mocha';
import { Console, Slack } from '../';

describe('Logger', () => {
  describe('.Console', () => {
    describe('#debug', () => {
      it('should run without issue', () => {
        Console.debug('This is test output');
      });
    });
    describe('#info', () => {
      it('should run without issue', () => {
        Console.info('This is test output');
      });
    });
    describe('#warn', () => {
      it('should run without issue', () => {
        Console.warn('This is test output');
      });
    });
    describe('#error', () => {
      it('should run without issue', () => {
        Console.error('This is test output');
        Console.error('This is test output', null);
        Console.error('This is test output', new Error('This is a test error'));
      });
    });
    describe('#silly', () => {
      it('should run without issue', () => {
        Console.silly('This is test output :D');
      });
    });
  });
  describe('.Slack', () => {
    describe('#logToChannel', () => {
      it('should log without a robot', () => {

      });
      it('should log to the console with a bad robot', () => {

      });
      it('should log with a robot', () => {

      });
    });
    describe('#errorToSlack', () => {
      it('should log an error without a robot', () => {

      });
      it('should log an error to the console with a bad robot', () => {

      });
      it('should log an error with a robot', () => {

      });
    });
    describe('#addReaction', () => {
      it('should react to the message without a robot', () => {

      });
      it('should react to the message with a bad robot', () => {

      });
      it('should react to the message with a robot', () => {

      });
    });
    describe('#removeReaction', () => {
      it('should unreact to the message without a robot', () => {

      });
      it('should unreact to the message with a bad robot', () => {

      });
      it('should unreact to the message with a robot', () => {

      });
    });
  });
});