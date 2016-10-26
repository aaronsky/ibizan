
import Logger from '../';

describe('Logger', () => {
  describe('.Console', () => {
    describe('#debug', () => {
      it('should run without issue', () => {
        Logger.Console.debug('This is test output');
      });
    });
    describe('#log', () => {
      it('should run without issue', () => {
        Logger.Console.log('This is test output');
      });
    });
    describe('#warn', () => {
      it('should run without issue', () => {
        Logger.Console.warn('This is test output');
      });
    });
    describe('#error', () => {
      it('should run without issue', () => {
        Logger.Console.error('This is test output');
        Logger.Console.error('This is test output', null);
        Logger.Console.error('This is test output', new Error('This is a test error'));
      });
    });
    describe('#fun', () => {
      it('should run without issue', () => {
        Logger.Console.fun('This is test output :D');
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