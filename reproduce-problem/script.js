import http from "k6/http";
import { check } from "k6";

const params = {
    headers: {
        "Content-Type": "application/json"
    }
};

const initialBalance= 100
const vus = 10
const iterations = 10
const chargeAmount = 1
export let options = {
    scenarios: {
        main_scenario: {
            executor: "shared-iterations",
            vus: vus,
            iterations: iterations
        }
    }
};
let expectedCharged = iterations * chargeAmount

export function setup() {
    const payload0 = {
        account: "test"
    };
    http.post("http://localhost:3000/reset", JSON.stringify(payload0), params);

    const payload = {
        account: "test",
        charges: 0
    };
    const res = http.post("http://localhost:3000/charge",
      JSON.stringify(payload), params);

    let result = JSON.parse(res.body);

    console.log(`Reset balance to: ${result.remainingBalance}`);
    console.log(`Will send ${iterations} requests charging the balance for ${chargeAmount} each`)
    check(result, {
        "Initial balance is 100": r => r.remainingBalance === initialBalance
    });
}

export default function() {
    const payload = {
        account: "test",
        charges: chargeAmount
    };
    const res = http.post("http://localhost:3000/charge",
      JSON.stringify(payload), params);

    let result = JSON.parse(res.body);
    console.log(res.body);

    check(result, {
        "Charge is authorized": r => r.isAuthorized,
        "Charges is correct": r => {
            return r.charges === chargeAmount;
        }
    });
}

export function teardown() {
    const payload = {
        account: "test",
        charges: 0
    };
    const res = http.post("http://localhost:3000/charge",
      JSON.stringify(payload), params);

    let result = JSON.parse(res.body);
    let expectedBalance = initialBalance - expectedCharged;
    console.log(
      `Final balance is: ${result.remainingBalance}; Expected balance is ${expectedBalance} (${initialBalance} - ${expectedCharged})`);

    check(result, {
        "Final balance is correct": r => r.remainingBalance === expectedBalance
    });
}
