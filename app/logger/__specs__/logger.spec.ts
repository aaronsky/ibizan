import 'mocha';
import '../console';
import { Slack } from '../';

describe('Logger', () => {
  describe('.Console', () => {
    describe('#debug', () => {
      it('should run without issue', () => {
        console.debug('This is test output');
      });
    });
    describe('#info', () => {
      it('should run without issue', () => {
        console.info('This is test output');
      });
    });
    describe('#warn', () => {
      it('should run without issue', () => {
        console.warn('This is test output');
      });
    });
    describe('#error', () => {
      it('should run without issue', () => {
        console.error('This is test output');
        console.error('This is test output', null);
        console.error('This is test output', new Error('This is a test error'));
      });
    });
    describe('#silly', () => {
      it('should run without issue', () => {
        console.silly('This is test output :D');
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