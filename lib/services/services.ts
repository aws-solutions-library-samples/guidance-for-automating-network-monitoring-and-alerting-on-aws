export interface AWSServiceInterface{
    generateDashboard():any;
}


export class AWSService{
    sort = "PRIMITIVE"
    protected arn:string;
    constructor(arn:string) {
        this.arn = arn;
    }

    public getType(){
        if ( this.arn.includes('apigateway') && this.arn.includes('restapis')){
            //console.log('Creating api gateway');
            return new APIGateway(this.arn);
        }
        return "No resource returned";
    }

    public getSort(){
        //console.log(this.sort);
    }


}


/***
 * Services, create dashboard making sense for each of the services
 */
export class APIGateway extends AWSService implements  AWSServiceInterface{
    sort = "API GATEWAY";

    constructor(arn:string) {
        super(arn);
    }

    generateDashboard(): any {
        //console.log(this.sort);
    }

}
